import { Router, type IRouter } from "express";
import ical from "node-ical";
import { RRule } from "rrule";

const router: IRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TZ = "America/Chicago";

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

function toDate(v: Date | string | number | undefined): Date {
  if (!v) return new Date(0);
  if (v instanceof Date) return v;
  return new Date(v);
}

// Get {year, month (1-based), day} in America/Chicago timezone
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

function sameChicagoDay(
  date: Date,
  year: number,
  month: number, // 1-based
  day: number,
): boolean {
  const p = chicagoParts(date);
  return p.year === year && p.month === month && p.day === day;
}

// UTC boundaries that bracket an entire Chicago day (accounting for CDT/CST ±6h buffer)
function chicagoDayWindowUTC(year: number, month: number, day: number): { start: Date; end: Date } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const base = `${year}-${pad(month)}-${pad(day)}`;
  // Chicago is UTC-6 (CST) or UTC-5 (CDT). A ±7h buffer safely covers the full local day in UTC.
  return {
    start: new Date(`${base}T00:00:00Z`), // Chicago day starts no earlier than this in UTC
    end: new Date(`${base}T23:59:59Z`),   // Chicago day ends no later than UTC+7h = next UTC day
  };
}

interface ParsedEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  description: string | null;
}

function extractMeta(event: ical.VEvent): {
  title: string;
  location: string | null;
  description: string | null;
} {
  return {
    title: typeof event.summary === "string" && event.summary.trim() ? event.summary.trim() : "(No title)",
    location: typeof event.location === "string" && event.location.trim() ? event.location.trim() : null,
    description: typeof event.description === "string" && event.description.trim() ? event.description.trim() : null,
  };
}

function makeEvent(
  uid: string,
  meta: ReturnType<typeof extractMeta>,
  start: Date,
  end: Date,
): ParsedEvent {
  return { id: uid, title: meta.title, start: start.toISOString(), end: end.toISOString(), location: meta.location, description: meta.description };
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
    typeof rawRrule === "string" ? rawRrule
    : typeof rawRrule === "object" && rawRrule !== null ? rawRrule.toString()
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

  // Query a UTC window that covers the full Chicago day plus generous buffer
  const { start: winStart, end: winEnd } = chicagoDayWindowUTC(year, month, day);
  // Extend ±7 hours to catch edge cases near day boundaries
  const queryStart = new Date(winStart.getTime() - 7 * 3600_000);
  const queryEnd = new Date(winEnd.getTime() + 7 * 3600_000);

  const candidates = rule.between(queryStart, queryEnd, true);

  // Filter to only occurrences that actually fall on the requested Chicago day
  const occurrences = candidates.filter((d) => sameChicagoDay(d, year, month, day));

  const meta = extractMeta(event);
  const uid = event.uid ?? `${dtstart.getTime()}-${meta.title}`;

  return occurrences.map((occDate) =>
    makeEvent(`${uid}-${occDate.getTime()}`, meta, occDate, new Date(occDate.getTime() + durationMs))
  );
}

router.get("/calendar/events", async (req, res): Promise<void> => {
  const rawUrl = req.query["url"];
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    res.status(400).json({ error: "Missing required query parameter: url" });
    return;
  }

  const rawDate = req.query["date"];
  let filterYear = 0, filterMonth = 0, filterDay = 0;
  let hasFilter = false;

  if (rawDate !== undefined) {
    if (typeof rawDate !== "string" || !DATE_RE.test(rawDate)) {
      res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
      return;
    }
    [filterYear, filterMonth, filterDay] = rawDate.split("-").map(Number);
    // filterMonth is already 1-based from the string
    hasFilter = true;
  }

  const calUrl = convertGoogleCalUrl(rawUrl.trim());

  try {
    const data = await ical.async.fromURL(calUrl);
    const events: ParsedEvent[] = [];
    const seen = new Set<string>();

    for (const key of Object.keys(data)) {
      const component = data[key];
      if (component.type !== "VEVENT") continue;
      const event = component as ical.VEvent;

      const hasRrule = !!(event as unknown as { rrule?: unknown }).rrule;

      if (hasRrule && hasFilter) {
        const occurrences = expandRecurring(event, filterYear, filterMonth, filterDay);
        for (const occ of occurrences) {
          if (!seen.has(occ.id)) {
            seen.add(occ.id);
            events.push(occ);
          }
        }
      } else {
        const dtstart = toDate(event.start);
        // Filter using Chicago timezone day comparison
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
      error: "Failed to fetch or parse the calendar. Check the URL and ensure the calendar is public.",
    });
  }
});

export default router;
