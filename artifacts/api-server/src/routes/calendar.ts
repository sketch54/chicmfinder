import { Router, type IRouter } from "express";
import ical from "node-ical";
import { RRule, RRuleSet } from "rrule";

const router: IRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface ParsedEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  description: string | null;
}

function makeEvent(
  uid: string,
  summary: string,
  start: Date,
  end: Date,
  location: string | null,
  description: string | null,
): ParsedEvent {
  return {
    id: uid,
    title: typeof summary === "string" && summary.trim() ? summary.trim() : "(No title)",
    start: start.toISOString(),
    end: end.toISOString(),
    location,
    description,
  };
}

// Extract occurrences of a recurring VEVENT that fall on filterDate (local time)
function expandRecurring(event: ical.VEvent, filterDate: Date): ParsedEvent[] {
  const dtstart = toDate(event.start);
  const dtend = toDate(event.end ?? event.start);
  const durationMs = dtend.getTime() - dtstart.getTime();

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
    // Ensure DTSTART is embedded so RRule uses the correct timezone offset
    const fullStr = rruleStr.includes("DTSTART")
      ? rruleStr
      : `DTSTART:${dtstart.toISOString().replace(/[-:]/g, "").split(".")[0]}Z\n${rruleStr}`;
    rule = RRule.fromString(fullStr);
  } catch {
    return [];
  }

  // Query the day window in UTC
  const dayStart = new Date(
    Date.UTC(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate(), 0, 0, 0),
  );
  const dayEnd = new Date(
    Date.UTC(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate(), 23, 59, 59),
  );

  const occurrences = rule.between(dayStart, dayEnd, true);

  // Also check in local-day terms — RRule UTC comparison can miss timezone-shifted events
  const localOccurrences = rule.all((d) => {
    const occ = new Date(d);
    return occ >= dayStart && occ <= dayEnd;
  });

  const allOccs = [...occurrences, ...localOccurrences].filter(
    (d, i, arr) => arr.findIndex((x) => x.getTime() === d.getTime()) === i,
  );

  if (allOccs.length === 0) {
    // Fallback: check if the base event itself falls on filterDate
    if (sameLocalDay(dtstart, filterDate)) {
      // Already handled by the non-recurring path; skip here
    }
    return [];
  }

  const title = typeof event.summary === "string" ? event.summary.trim() : "(No title)";
  const location =
    typeof event.location === "string" && event.location.trim() ? event.location.trim() : null;
  const description =
    typeof event.description === "string" && event.description.trim()
      ? event.description.trim()
      : null;

  return allOccs.map((occDate, idx) => {
    const occStart = occDate;
    const occEnd = new Date(occDate.getTime() + durationMs);
    const uid = event.uid ? `${event.uid}-${occDate.getTime()}` : `${occDate.getTime()}-${idx}`;
    return makeEvent(uid, title, occStart, occEnd, location, description);
  });
}

router.get("/calendar/events", async (req, res): Promise<void> => {
  const rawUrl = req.query["url"];
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    res.status(400).json({ error: "Missing required query parameter: url" });
    return;
  }

  const rawDate = req.query["date"];
  let filterDate: Date | null = null;
  if (rawDate !== undefined) {
    if (typeof rawDate !== "string") {
      res.status(400).json({ error: "date must be a string" });
      return;
    }
    if (!DATE_RE.test(rawDate)) {
      res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
      return;
    }
    // Parse as local midnight to match event local start times
    const [y, m, d] = rawDate.split("-").map(Number);
    filterDate = new Date(y, m - 1, d, 0, 0, 0);
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

      if (hasRrule && filterDate !== null) {
        // Expand recurring events for the requested date
        const occurrences = expandRecurring(event, filterDate);
        for (const occ of occurrences) {
          if (!seen.has(occ.id)) {
            seen.add(occ.id);
            events.push(occ);
          }
        }
      } else {
        // Non-recurring event
        const dtstart = toDate(event.start);
        if (filterDate !== null && !sameLocalDay(dtstart, filterDate)) continue;

        const dtend = toDate(event.end ?? event.start);
        const title = typeof event.summary === "string" ? event.summary.trim() : "(No title)";
        const location =
          typeof event.location === "string" && event.location.trim()
            ? event.location.trim()
            : null;
        const description =
          typeof event.description === "string" && event.description.trim()
            ? event.description.trim()
            : null;
        const uid =
          event.uid ?? `${dtstart.getTime()}-${title}`;

        if (!seen.has(uid)) {
          seen.add(uid);
          events.push(makeEvent(uid, title, dtstart, dtend, location, description));
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
