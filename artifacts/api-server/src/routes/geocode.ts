import { Router, type IRouter } from "express";

const router: IRouter = Router();

const geocodeCache = new Map<string, { lat: number; lng: number; displayName: string } | null>();

const CHICAGO_LAT = 41.8781;
const CHICAGO_LNG = -87.6298;
const MAX_MILES = 100;
const MAX_METERS = MAX_MILES * 1609.34;

function haversineDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function queryArcGIS(
  address: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const params = new URLSearchParams({
    SingleLine: address.trim(),
    outFields: "Match_addr",
    maxLocations: "1",
    f: "json",
    location: `${CHICAGO_LNG},${CHICAGO_LAT}`,
    distance: String(MAX_METERS),
  });

  const response = await fetch(
    `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?${params.toString()}`,
    {
      headers: { "User-Agent": "CarMeetsMapApp/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    },
  );

  if (!response.ok) {
    throw Object.assign(new Error("ArcGIS geocoding error"), { status: response.status });
  }

  const data = (await response.json()) as {
    candidates?: Array<{ address: string; location: { x: number; y: number }; score: number }>;
  };

  if (!data.candidates || data.candidates.length === 0) return null;

  const best = data.candidates[0];
  const lat = best.location.y;
  const lng = best.location.x;

  const dist = haversineDistanceMiles(CHICAGO_LAT, CHICAGO_LNG, lat, lng);
  if (dist > MAX_MILES) return null;

  return { lat, lng, displayName: best.address };
}

// Generate progressively simplified fallback queries from a raw address string
function fallbackQueries(raw: string): string[] {
  const queries: string[] = [];
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);

  // Try removing the first part (venue name) and keeping the rest
  if (parts.length > 1) {
    queries.push(parts.slice(1).join(", "));
  }

  // Try keeping only the last two parts (city, state/zip/country)
  if (parts.length > 2) {
    queries.push(parts.slice(-2).join(", "));
  }

  // Try the last part alone (state or city+state)
  if (parts.length > 1) {
    queries.push(parts[parts.length - 1]);
  }

  // For no-comma addresses like "Downtown Bensenville IL":
  // strip leading words like "Downtown", "North", "South", etc. and try what remains
  if (parts.length === 1) {
    const words = raw.trim().split(/\s+/);
    const stripWords = new Set(["downtown", "north", "south", "east", "west", "old", "upper", "lower"]);
    if (stripWords.has(words[0].toLowerCase())) {
      queries.push(words.slice(1).join(" "));
    }
    // Also try last 3 words (city + state)
    if (words.length > 3) {
      queries.push(words.slice(-3).join(" "));
    }
    // Last 2 words
    if (words.length > 2) {
      queries.push(words.slice(-2).join(" "));
    }
  }

  // Deduplicate while preserving order, also remove the original
  return [...new Set(queries)].filter((q) => q.toLowerCase() !== raw.toLowerCase().trim());
}

async function geocodeWithFallback(
  address: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const cacheKey = address.toLowerCase().trim();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }

  // Try the full address first
  let result = await queryArcGIS(address);

  // If that didn't work, try progressively simplified versions
  if (!result) {
    for (const fallback of fallbackQueries(address)) {
      result = await queryArcGIS(fallback);
      if (result) break;
    }
  }

  geocodeCache.set(cacheKey, result);
  return result;
}

router.get("/geocode", async (req, res): Promise<void> => {
  const address = req.query["address"];
  if (typeof address !== "string" || !address.trim()) {
    res.status(400).json({ error: "Missing required query parameter: address" });
    return;
  }

  try {
    const result = await geocodeWithFallback(address);
    if (!result) {
      res.status(404).json({ error: "Address not found within Chicago area" });
      return;
    }
    res.json(result);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    req.log.warn({ err, status }, "Geocoding request failed");
    res.status(502).json({ error: "Geocoding temporarily unavailable" });
  }
});

export default router;
