import { Router, type IRouter } from "express";
import ical from "node-ical";

const router: IRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function convertGoogleCalUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    // newembed or embed URL → convert to ical feed
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

function parseVEvent(event: ical.VEvent): {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  description: string | null;
} {
  const start = event.start instanceof Date ? event.start : new Date(event.start);
  const end = event.end instanceof Date ? event.end : new Date(event.end ?? event.start);

  const rawDesc = event.description ?? null;
  const description = typeof rawDesc === "string" ? rawDesc.trim() || null : null;

  const rawLoc = event.location ?? null;
  const location = typeof rawLoc === "string" ? rawLoc.trim() || null : null;

  return {
    id: event.uid ?? `${start.getTime()}-${event.summary}`,
    title: typeof event.summary === "string" ? event.summary.trim() : "(No title)",
    start: start.toISOString(),
    end: end.toISOString(),
    location,
    description,
  };
}

function sameDay(eventStart: Date, filterDate: Date): boolean {
  return (
    eventStart.getFullYear() === filterDate.getFullYear() &&
    eventStart.getMonth() === filterDate.getMonth() &&
    eventStart.getDate() === filterDate.getDate()
  );
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
    filterDate = new Date(rawDate + "T00:00:00");
  }

  const calUrl = convertGoogleCalUrl(rawUrl.trim());

  try {
    const data = await ical.async.fromURL(calUrl);
    const events: ReturnType<typeof parseVEvent>[] = [];

    for (const key of Object.keys(data)) {
      const component = data[key];
      if (component.type !== "VEVENT") continue;
      const event = component as ical.VEvent;
      const parsed = parseVEvent(event);

      if (filterDate !== null) {
        const eventStart = new Date(parsed.start);
        if (!sameDay(eventStart, filterDate)) continue;
      }

      events.push(parsed);
    }

    // Sort by start time
    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    res.json(events);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch or parse calendar");
    res.status(502).json({ error: "Failed to fetch or parse the calendar. Check the URL and ensure the calendar is public." });
  }
});

export default router;
