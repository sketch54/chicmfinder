import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ─── Weekly unique-visitor counter (in-memory) ───────────────────────────────
// Keyed by ISO week string "YYYY-WNN". Resets automatically each new week.

interface WeekBucket {
  weekKey: string;
  ips: Set<string>;
}

let bucket: WeekBucket = { weekKey: "", ips: new Set() };

/** Returns the ISO week key for a given Date, e.g. "2026-W31". */
function isoWeekKey(d: Date): string {
  // Copy so we don't mutate the original
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday (ISO week belongs to the year of its Thursday)
  const day = date.getUTCDay() || 7; // Sunday = 0 → 7
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Record a visitor and return the current weekly unique-visitor count. */
function recordVisit(ip: string): number {
  const key = isoWeekKey(new Date());
  if (bucket.weekKey !== key) {
    // New week — reset bucket
    bucket = { weekKey: key, ips: new Set() };
  }
  bucket.ips.add(ip);
  return bucket.ips.size;
}

// GET /api/visitors — records the caller and returns the weekly count
router.get("/visitors", (req, res) => {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";
  const count = recordVisit(ip);
  res.json({ weeklyVisitors: count });
});

export default router;
