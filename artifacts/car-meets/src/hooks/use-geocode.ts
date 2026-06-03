import { useQuery } from "@tanstack/react-query";

interface GeoResult {
  lat: number;
  lng: number;
  displayName: string;
}

async function nominatimGeocode(address: string): Promise<GeoResult | null> {
  const params = new URLSearchParams({ q: address, format: "json", limit: "1" });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: { "User-Agent": "CarMeetsMapApp/1.0", Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name };
}

export function useGeocode(address: string | null | undefined) {
  return useQuery<GeoResult | null>({
    queryKey: ["geocode", address],
    queryFn: () => nominatimGeocode(address!),
    enabled: !!address,
    staleTime: 1000 * 60 * 60 * 24,
    retry: 1,
    retryDelay: 2000,
  });
}
