import { Router, type IRouter } from "express";

const router: IRouter = Router();

const geocodeCache = new Map<string, { lat: number; lng: number; displayName: string } | null>();

async function geocodeWithArcGIS(
  address: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const cacheKey = address.toLowerCase().trim();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }

  const params = new URLSearchParams({
    SingleLine: address.trim(),
    outFields: "Match_addr",
    maxLocations: "1",
    f: "json",
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
    candidates?: Array<{
      address: string;
      location: { x: number; y: number };
      score: number;
    }>;
  };

  if (!data.candidates || data.candidates.length === 0) {
    geocodeCache.set(cacheKey, null);
    return null;
  }

  const best = data.candidates[0];
  const result = { lat: best.location.y, lng: best.location.x, displayName: best.address };
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
    const result = await geocodeWithArcGIS(address);
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
