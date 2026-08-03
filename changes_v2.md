# changes_v2.md — Technical delta since RUN_LOCALLY.md

Developer/ops reference. Covers every API, dependency, and infrastructure change required to run the updated program.

---

## Environment variables

| Variable | Before | After |
|----------|--------|-------|
| `SESSION_SECRET` | Required | Required (unchanged) |
| `DATABASE_URL` | Listed as optional | **Removed** — no longer referenced anywhere in the codebase; drop it |
| `PORT` | Required by API server | Required (unchanged) |

---

## Dependencies

**No new npm packages were added.** All new backend code uses Node.js built-in modules only:

| Module | Source | Used in |
|--------|--------|---------|
| `node:fs` | Node built-in | `artifacts/api-server/src/routes/visitors.ts` |
| `node:path` | Node built-in | `artifacts/api-server/src/routes/visitors.ts` |

Run `pnpm install` is **not required** unless your `node_modules` is stale.

---

## New API route

### `GET /api/visitors`

Added to `artifacts/api-server/src/routes/visitors.ts`, registered in `artifacts/api-server/src/routes/index.ts`.

**Behavior:**
- Extracts caller IP from `X-Forwarded-For` header (first value), falling back to `req.socket.remoteAddress`
- Adds the IP and a timestamp to an in-memory rolling log
- Prunes entries older than 7 days on every call
- Flushes the full log to disk after each write (see Filesystem section below)
- Returns the count of unique IPs seen in the last 7 days

**Response — `200 OK`:**
```json
{ "weeklyVisitors": 42 }
```

**No authentication.** Intentionally public — returns only the aggregate count, not the raw IP data.

> **Note:** This route is not in `lib/api-spec/openapi.yaml` and has no generated React Query hook. The frontend calls it with a plain `fetch` inside a `useQuery`. If you regenerate the API client from the spec this route will not be affected.

---

## Removed API route

### `GET /api/admin/visitors` — **deleted**

A temporary HTML admin table endpoint was created and then removed in the same session. It does not exist in the codebase. Any bookmark or reverse-proxy rule pointing to `/api/admin/visitors` will receive `404`.

---

## Removed runtime configuration

The calendar URL was previously settable at runtime via a Settings modal (stored in `localStorage`). That modal and all related state have been removed.

**The URL is now a compile-time constant:**

```
artifacts/car-meets/src/pages/home.tsx
  → const DEFAULT_CALENDAR_URL = "https://..."
```

To change the calendar source, edit that constant and rebuild the frontend. There is no runtime flag, environment variable, or API parameter for this.

---

## Filesystem — new write path

The API server now writes a persistent visitor log to disk on every request to `GET /api/visitors`.

| Property | Value |
|----------|-------|
| **Path** | `data/visitor-log.json` relative to `process.cwd()` of the API server process |
| **Resolved path** | `artifacts/api-server/data/visitor-log.json` when started via `pnpm --filter @workspace/api-server run dev` |
| **Created automatically** | Yes — `fs.mkdirSync(..., { recursive: true })` runs before every write |
| **Format** | JSON object: `{ "<ip>": [<timestamp_ms>, ...], ... }` |
| **Loaded on startup** | Yes — hydrated from disk into memory when the module loads |
| **Failure behavior** | Non-fatal; write errors are silently caught; in-memory data remains accurate |

**Permission requirement:** The OS user running the API server process must have write access to the `artifacts/api-server/data/` directory. On a standard local clone this is automatic. On a locked-down server, pre-create the directory and confirm ownership:

```bash
mkdir -p artifacts/api-server/data
chown <your-run-user> artifacts/api-server/data
```

**The file is not served over HTTP.** It is only accessible via the local filesystem. To read it:

```bash
cat artifacts/api-server/data/visitor-log.json | python3 -m json.tool
# or
node -e "
  const d = JSON.parse(require('fs').readFileSync('artifacts/api-server/data/visitor-log.json','utf8'));
  const now = Date.now(), week = 7*24*60*60*1000;
  const rows = Object.entries(d)
    .map(([ip,ts]) => ({ ip, hits: ts.filter(t => t >= now-week).length, last: new Date(Math.max(...ts)).toISOString() }))
    .sort((a,b) => b.hits - a.hits);
  console.table(rows);
"
```

---

## OpenAPI spec

`lib/api-spec/openapi.yaml` was **not modified**. The `/api/visitors` route is intentionally outside the spec and the generated client. The existing codegen workflow (`lib/api-client-react/`) is unaffected.

---

## Build / start commands

Unchanged from `RUN_LOCALLY.md`. No new scripts, no new build steps.

```bash
# API server
pnpm --filter @workspace/api-server run dev

# Frontend
pnpm --filter @workspace/car-meets run dev
```
