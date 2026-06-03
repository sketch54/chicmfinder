import { useQuery } from "@tanstack/react-query";
import { useGeocodeAddress, getGeocodeAddressQueryKey } from "@workspace/api-client-react";

export { useGeocodeAddress as useGeocode, getGeocodeAddressQueryKey };

// Re-export a convenience wrapper with the same shape as before
export function useGeocodeLocation(address: string | null | undefined) {
  return useGeocodeAddress(
    { address: address ?? "" },
    { query: { enabled: !!address, queryKey: getGeocodeAddressQueryKey({ address: address ?? "" }) } },
  );
}
