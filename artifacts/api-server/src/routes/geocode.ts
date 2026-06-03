import { Router, type IRouter } from "express";

const router: IRouter = Router();

// In-memory geocode cache — avoids re-geocoding the same address
const geocodeCache = new Map<string, { lat: number; lng: number; displayName: string } | null>();

// Serial queue with 300ms spacing to be a good citizen to Photon
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 300;
let pendingRequest: Promise<void> = Promise.resolve();

function scheduleGeocodeRequest<T>(fn: () => Promise<T>): Promise<T> {
  const result = pendingRequest.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, lastRequestTime + MIN_INTERVAL_MS - now);
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    lastRequestTime = Date.now();
    return fn();
  });
  pendingRequest = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function geocodeWithPhoton(
  address: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const cacheKey = address.toLowerCase().trim();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }

  const result = await scheduleGeocodeRequest(async () => {
    const params = new URLSearchParams({ q: address.trim(), limit: "1" });
    const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      headers: {
        "User-Agent": "CarMeetsMapApp/1.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw Object.assign(new Error("Photon geocoding error"), { status: response.status });
    }

    const data = (await response.json()) as {
      features?: Array<{
        geometry: { coordinates: [number, number] };
        properties: { name?: string; city?: string; state?: string; country?: string };
      }>;
    };

    if (!data.features || data.features.length === 0) return null;

    const feature = data.features[0];
    const [lng, lat] = feature.geometry.coordinates;
    const p = feature.properties;
    const displayName = [p.name, p.city, p.state, p.country].filter(Boolean).join(", ");

    return { lat, lng, displayName };
  });

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
    const result = await geocodeWithPhoton(address);
    if (!result) {
      res.status(404).json({ error: "Address not found" });
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
