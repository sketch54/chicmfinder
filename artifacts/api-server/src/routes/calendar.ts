import { Router, type IRouter } from "express";
import ical from "node-ical";
import { RRule } from "rrule";

const router: IRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TZ = "America/Chicago";

// ─── 3am Chicago cache ───────────────────────────────────────────────────────

interface CacheEntry {
  data: ical.CalendarResponse;
  validUntil: Date;
}

const calendarCache = new Map<string, CacheEntry>();

/**
 * Compute the next occurrence of 3:00 AM America/Chicago as a UTC Date.
 * If the current Chicago time is before 3am, returns today's 3am.
 * Otherwise, returns tomorrow's 3am.
 */
function next3amChicagoUTC(from: Date = new Date()): Date {
  // Get current hour in Chicago
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
  }).format(from);
  const chicagoHour = parseInt(hourStr) % 24;

  // Determine target day: if already past 3am Chicago, use tomorrow
  const daysToAdd = chicagoHour >= 3 ? 1 : 0;
  const candidate = new Date(from.getTime() + daysToAdd * 86_400_000);

  // Get the Chicago date string (YYYY-MM-DD) for the target day
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(candidate);

  // Compute Chicago UTC offset at noon that day (avoids DST edge cases at midnight)
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);
  const noonChicagoHour =
    parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        hour: "2-digit",
        hour12: false,
      }).format(noonUtc),
    ) % 24;
  const utcOffsetHours = 12 - noonChicagoHour; // e.g. CDT=5, CST=6

  // 3am Chicago = 3 + utcOffsetHours in UTC on that day
  return new Date(`${dateStr}T${String(3 + utcOffsetHours).padStart(2, "0")}:00:00Z`);
}

async function getCalendarData(calUrl: string): Promise<ical.CalendarResponse> {
  const now = new Date();
  const cached = calendarCache.get(calUrl);
  if (cached && now < cached.validUntil) {
    return cached.data;
  }
  const data = await ical.async.fromURL(calUrl);
  calendarCache.set(calUrl, { data, validUntil: next3amChicagoUTC(now) });
  return data;
}

// ─── URL helpers ─────────────────────────────────────────────────────────────

function convertGoogleCalUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (
      (u.pathname.includes("/calendar/newembed") || u.pathname.includes("/calendar/embed")) &&
      u.searchParams.has("src")
    ) {
      const calId = u.searchParams.get("src")!;
      return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calId)}/public/basic.ics`;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDate(v: Date | string | number | undefined): Date {
  if (!v) return new Date(0);
  if (v instanceof Date) return v;
  return new Date(v);
}

function chicagoParts(date: Date): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = fmt.formatToParts(date);
  return {
    year: +parts.find((p) => p.type === "year")!.value,
    month: +parts.find((p) => p.type === "month")!.value,
    day: +parts.find((p) => p.type === "day")!.value,
  };
}

function sameChicagoDay(date: Date, year: number, month: number, day: number): boolean {
  const p = chicagoParts(date);
  return p.year === year && p.month === month && p.day === day;
}

function chicagoDayWindowUTC(
  year: number,
  month: number,
  day: number,
): { start: Date; end: Date } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const base = `${year}-${pad(month)}-${pad(day)}`;
  return {
    start: new Date(`${base}T00:00:00Z`),
    end: new Date(`${base}T23:59:59Z`),
  };
}

// ─── Event helpers ────────────────────────────────────────────────────────────

interface ParsedEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  description: string | null;
}

function extractMeta(event: ical.VEvent) {
  return {
    title:
      typeof event.summary === "string" && event.summary.trim()
        ? event.summary.trim()
        : "(No title)",
    location:
      typeof event.location === "string" && event.location.trim()
        ? event.location.trim()
        : null,
    description:
      typeof event.description === "string" && event.description.trim()
        ? event.description.trim()
        : null,
  };
}

function makeEvent(
  uid: string,
  meta: ReturnType<typeof extractMeta>,
  start: Date,
  end: Date,
): ParsedEvent {
  return {
    id: uid,
    title: meta.title,
    start: start.toISOString(),
    end: end.toISOString(),
    location: meta.location,
    description: meta.description,
  };
}

function expandRecurring(
  event: ical.VEvent,
  year: number,
  month: number,
  day: number,
): ParsedEvent[] {
  const dtstart = toDate(event.start);
  const dtend = toDate(event.end ?? event.start);
  const durationMs = Math.max(0, dtend.getTime() - dtstart.getTime());

  const rawRrule = (event as unknown as { rrule?: string | { toString(): string } }).rrule;
  if (!rawRrule) return [];

  const rruleStr =
    typeof rawRrule === "string"
      ? rawRrule
      : typeof rawRrule === "object" && rawRrule !== null
        ? rawRrule.toString()
        : "";
  if (!rruleStr) return [];

  let rule: RRule;
  try {
    const full = rruleStr.includes("DTSTART")
      ? rruleStr
      : `DTSTART:${dtstart.toISOString().replace(/[-:.]/g, "").slice(0, 15)}Z\n${rruleStr}`;
    rule = RRule.fromString(full);
  } catch {
    return [];
  }

  const { start: winStart, end: winEnd } = chicagoDayWindowUTC(year, month, day);
  const queryStart = new Date(winStart.getTime() - 7 * 3600_000);
  const queryEnd = new Date(winEnd.getTime() + 7 * 3600_000);
  const candidates = rule.between(queryStart, queryEnd, true);
  const occurrences = candidates.filter((d) => sameChicagoDay(d, year, month, day));

  const meta = extractMeta(event);
  const uid = event.uid ?? `${dtstart.getTime()}-${meta.title}`;

  return occurrences.map((occDate) =>
    makeEvent(
      `${uid}-${occDate.getTime()}`,
      meta,
      occDate,
      new Date(occDate.getTime() + durationMs),
    ),
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.get("/calendar/events", async (req, res): Promise<void> => {
  const rawUrl = req.query["url"];
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    res.status(400).json({ error: "Missing required query parameter: url" });
    return;
  }

  const rawDate = req.query["date"];
  let filterYear = 0,
    filterMonth = 0,
    filterDay = 0;
  let hasFilter = false;

  if (rawDate !== undefined) {
    if (typeof rawDate !== "string" || !DATE_RE.test(rawDate)) {
      res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
      return;
    }
    [filterYear, filterMonth, filterDay] = rawDate.split("-").map(Number);
    hasFilter = true;
  }

  const calUrl = convertGoogleCalUrl(rawUrl.trim());

  try {
    const data = await getCalendarData(calUrl);
    const events: ParsedEvent[] = [];
    const seen = new Set<string>();

    for (const key of Object.keys(data)) {
      const component = data[key];
      if (component.type !== "VEVENT") continue;
      const event = component as ical.VEvent;

      const hasRrule = !!(event as unknown as { rrule?: unknown }).rrule;

      if (hasRrule && hasFilter) {
        for (const occ of expandRecurring(event, filterYear, filterMonth, filterDay)) {
          if (!seen.has(occ.id)) {
            seen.add(occ.id);
            events.push(occ);
          }
        }
      } else {
        const dtstart = toDate(event.start);
        if (hasFilter && !sameChicagoDay(dtstart, filterYear, filterMonth, filterDay)) continue;

        const dtend = toDate(event.end ?? event.start);
        const meta = extractMeta(event);
        const uid = event.uid ?? `${dtstart.getTime()}-${meta.title}`;
        if (!seen.has(uid)) {
          seen.add(uid);
          events.push(makeEvent(uid, meta, dtstart, dtend));
        }
      }
    }

    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    res.json(events);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch or parse calendar");
    res.status(502).json({
      error:
        "Failed to fetch or parse the calendar. Check the URL and ensure the calendar is public.",
    });
  }
});

export default router;
