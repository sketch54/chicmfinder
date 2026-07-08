# Running Car Meets Map Locally

## Prerequisites (install once)

| Tool | Version | How to get |
|------|---------|------------|
| **Node.js** | v24 | [nodejs.org](https://nodejs.org) — download the "Current" release |
| **pnpm** | v10 | `npm install -g pnpm` after installing Node |

---

## Environment variables

Create a `.env` file in the project root, or export these in your shell before running:

| Variable | Required? | Notes |
|----------|----------|-------|
| `SESSION_SECRET` | Yes | Any long random string — generate one with `openssl rand -hex 32` |
| `DATABASE_URL` | Only if using DB features | Postgres connection string — the calendar/map features don't currently need it, but the API server package references it |

---

## Steps to run

```bash
# 1. Clone / download the project
git clone <your-repo-url>
cd <project-folder>

# 2. Install all dependencies
pnpm install

# 3. Set environment variables
export SESSION_SECRET="some-random-secret-here"

# 4. Start the API server (in one terminal)
pnpm --filter @workspace/api-server run dev

# 5. Start the frontend (in a second terminal)
pnpm --filter @workspace/car-meets run dev
```

The frontend (Vite) will print a local URL such as `http://localhost:5173` — open that in your browser.

---

## No external API keys required

| Service | Key needed? |
|---------|------------|
| **ArcGIS geocoding** | No — uses the free public endpoint |
| **Google Calendar** | No — reads the public iCal `.ics` URL directly |
| **Map tiles** | No — uses free Carto/OpenStreetMap tiles via Leaflet |

---

## Changing the calendar

The app defaults to a public Chicago-area car meets Google Calendar. To point it at a different calendar:

1. Open the app in your browser.
2. Click the **Settings** (gear) icon in the sidebar.
3. Paste any public Google Calendar iCal URL (ends in `.ics`).

The calendar URL is saved in your browser's `localStorage`, so it persists across page reloads.
