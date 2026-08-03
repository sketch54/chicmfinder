# changes_v2.md — What's changed since RUN_LOCALLY.md

Everything in `RUN_LOCALLY.md` still applies except for the items below.

---

## 1. `DATABASE_URL` is no longer needed

The API server no longer references `DATABASE_URL` anywhere. You can remove it from your `.env` or shell exports entirely. Only `SESSION_SECRET` is required.

---

## 2. Changing the calendar URL (the Settings gear is gone)

The gear icon and settings UI have been removed. The calendar URL is now a hardcoded constant in the frontend source:

**File:** `artifacts/car-meets/src/pages/home.tsx`

```ts
const DEFAULT_CALENDAR_URL =
  "https://calendar.google.com/calendar/ical/...your-url.../basic.ics";
```

To point the app at a different calendar, edit that string and restart the frontend (`pnpm --filter @workspace/car-meets run dev`).

---

## 3. Editable "About" text

A plain-text file controls what appears in the **ⓘ** info modal in the sidebar:

**File:** `artifacts/car-meets/public/info.txt`

Edit it freely — no rebuild needed, the frontend fetches it at runtime. Note: the current content still mentions a gear icon that no longer exists; update that paragraph if you use the file as-is.

---

## 4. Visitor log file (auto-created, no setup needed)

The API server now writes a rolling visitor log to disk on every page load:

**File:** `artifacts/api-server/data/visitor-log.json`

- Created automatically the first time the server receives a request — no action required.
- Contains a JSON map of `IP → [timestamp_ms, ...]` for all visits in the last 7 days.
- **Not accessible over HTTP** — read it directly via your file system or shell only.
- Persists across server restarts.

---

## New features (no setup required)

These were added and work out of the box:

| Feature | How to use |
|---------|------------|
| **Event detail modal** | Click any event card in the sidebar |
| **Info modal** | Click the **ⓘ** icon in the sidebar header |
| **Proximity sort** | Click **Sort Nearby** (bottom-right) to drop a draggable pin; sidebar re-sorts by distance |
| **Weekly visitor count** | Shows automatically under the header — rolling 7-day unique-IP count |
| **Map bounds / zoom limit** | Map is constrained to ~150-mile radius around Chicago; min zoom = 7 |
