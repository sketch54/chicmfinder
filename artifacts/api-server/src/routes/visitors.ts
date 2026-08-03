import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";

const router: IRouter = Router();

// ─── Rolling 7-day visitor tracker ───────────────────────────────────────────
// In-memory store: IP → array of visit timestamps (ms).
// On every visit the log is also flushed to a local JSON file on disk.
// The HTTP admin endpoint has been intentionally removed — the log is only
// accessible by reading the file directly on the server (Replit shell / editor).

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Map of IP → array of visit timestamps (ms). */
const visitLog = new Map<string, number[]>();

// ─── Disk persistence ────────────────────────────────────────────────────────

const LOG_DIR = path.resolve(process.cwd(), "data");
const LOG_PATH = path.join(LOG_DIR, "visitor-log.json");

/** Load persisted log from disk into memory (called once at startup). */
function loadLogFromDisk(): void {
  try {
    if (!fs.existsSync(LOG_PATH)) return;
    const raw = fs.readFileSync(LOG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, number[]>;
    for (const [ip, times] of Object.entries(parsed)) {
      if (Array.isArray(times)) visitLog.set(ip, times);
    }
  } catch {
    // Corrupt or missing file — start fresh
  }
}

/** Flush the in-memory log to disk as JSON. */
function flushToDisk(): void {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const obj: Record<string, number[]> = {};
    for (const [ip, times] of visitLog) {
      obj[ip] = times;
    }
    fs.writeFileSync(LOG_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch {
    // Non-fatal: in-memory data is still accurate
  }
}

// Hydrate from disk on module load
loadLogFromDisk();

// ─── Core logic ──────────────────────────────────────────────────────────────

/** Prune timestamps older than 7 days from every IP's array. */
function pruneOldVisits(): void {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  for (const [ip, times] of visitLog) {
    const fresh = times.filter((t) => t >= cutoff);
    if (fresh.length === 0) {
      visitLog.delete(ip);
    } else {
      visitLog.set(ip, fresh);
    }
  }
}

/** Record a visit and return the rolling-7-day unique-visitor count. */
function recordVisit(ip: string): number {
  pruneOldVisits();
  const times = visitLog.get(ip) ?? [];
  times.push(Date.now());
  visitLog.set(ip, times);
  flushToDisk();
  return visitLog.size;
}

// ─── Public endpoint ─────────────────────────────────────────────────────────
// GET /api/visitors — records the caller, returns rolling-7-day unique count.
// No admin/IP-log endpoint is exposed over HTTP.

router.get("/visitors", (req, res) => {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";
  const count = recordVisit(ip);
  res.json({ weeklyVisitors: count });
});

export default router;
