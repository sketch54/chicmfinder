import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ─── Rolling 7-day visitor tracker (in-memory) ───────────────────────────────
// Each IP is stored with an array of visit timestamps.
// "Unique visitors" = IPs that have at least one visit in the last 7 days.
// The internal log tracks total hit counts per IP across all recorded history.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Map of IP → array of visit timestamps (ms). */
const visitLog = new Map<string, number[]>();

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
  return visitLog.size; // every key in the map had ≥1 visit in last 7 days
}

// GET /api/visitors — public: records caller, returns rolling-7-day unique count
router.get("/visitors", (req, res) => {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";
  const count = recordVisit(ip);
  res.json({ weeklyVisitors: count });
});

// GET /api/admin/visitors — internal: HTML table of IPs, hit counts, last seen
// Not linked from the public frontend; access directly in browser.
router.get("/admin/visitors", (_req, res) => {
  pruneOldVisits();

  // Build rows sorted by total hits descending
  const rows = [...visitLog.entries()]
    .map(([ip, times]) => ({
      ip,
      hits: times.length,
      lastSeen: new Date(Math.max(...times)).toISOString(),
      firstSeen: new Date(Math.min(...times)).toISOString(),
    }))
    .sort((a, b) => b.hits - a.hits);

  const totalUnique = rows.length;
  const totalHits = rows.reduce((s, r) => s + r.hits, 0);

  const tableRows = rows
    .map(
      (r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><code>${r.ip}</code></td>
      <td>${r.hits}</td>
      <td>${r.firstSeen}</td>
      <td>${r.lastSeen}</td>
    </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Visitor Log — CHICARMEET.US</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: system-ui, sans-serif;
      background: #0d0d0d;
      color: #e0e0e0;
      margin: 0;
      padding: 2rem;
    }
    h1 { color: #e83855; margin-bottom: 0.25rem; font-size: 1.4rem; letter-spacing: 0.05em; text-transform: uppercase; }
    p.meta { color: #888; font-size: 0.85rem; margin-bottom: 1.5rem; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    thead th {
      background: #1a1a1a;
      color: #e83855;
      text-align: left;
      padding: 0.6rem 0.9rem;
      border-bottom: 2px solid #e83855;
      white-space: nowrap;
    }
    tbody tr:nth-child(even) { background: #141414; }
    tbody tr:hover { background: #1f1f1f; }
    td {
      padding: 0.5rem 0.9rem;
      border-bottom: 1px solid #222;
      vertical-align: middle;
    }
    code { font-size: 0.82rem; color: #a8d8ea; }
    .summary {
      display: flex;
      gap: 2rem;
      margin-bottom: 1.5rem;
    }
    .stat { background: #1a1a1a; border: 1px solid #333; border-radius: 6px; padding: 0.75rem 1.25rem; }
    .stat-val { font-size: 1.5rem; font-weight: 700; color: #e83855; }
    .stat-label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
    .window-note { font-size: 0.75rem; color: #555; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>CHICARMEET.US — Visitor Log</h1>
  <p class="meta">Rolling 7-day window · in-memory · resets on server restart</p>
  <div class="summary">
    <div class="stat">
      <div class="stat-val">${totalUnique}</div>
      <div class="stat-label">Unique IPs (7d)</div>
    </div>
    <div class="stat">
      <div class="stat-val">${totalHits}</div>
      <div class="stat-label">Total Hits (7d)</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>IP Address</th>
        <th>Hits (7d)</th>
        <th>First Seen</th>
        <th>Last Seen</th>
      </tr>
    </thead>
    <tbody>
      ${rows.length > 0 ? tableRows : '<tr><td colspan="5" style="text-align:center;color:#555;padding:2rem">No visitors recorded yet.</td></tr>'}
    </tbody>
  </table>
  <p class="window-note">Generated at ${new Date().toISOString()}</p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
