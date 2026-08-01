// =============================================================================
// Indonesia administrative regions — client API via server proxy (CORS-safe)
// =============================================================================

import { neonCall } from "@/lib/api/backend";
import { neonFetchIndonesiaWilayah } from "@/lib/api/neon/fns";

export interface WilayahItem {
  code: string;
  name: string;
}

async function fetchWilayah(path: string): Promise<WilayahItem[]> {
  const result = await neonCall(() => neonFetchIndonesiaWilayah({ data: { path } }));
  if (result.error) throw new Error(result.error);
  return result.data ?? [];
}

export function fetchProvinces(): Promise<WilayahItem[]> {
  return fetchWilayah("/provinces.json");
}

export function fetchRegencies(provinceCode: string): Promise<WilayahItem[]> {
  return fetchWilayah(`/regencies/${encodeURIComponent(provinceCode)}.json`);
}

export function fetchDistricts(regencyCode: string): Promise<WilayahItem[]> {
  return fetchWilayah(`/districts/${encodeURIComponent(regencyCode)}.json`);
}

export function fetchVillages(districtCode: string): Promise<WilayahItem[]> {
  return fetchWilayah(`/villages/${encodeURIComponent(districtCode)}.json`);
}

export function formatIndonesiaAddress(parts: {
  street: string;
  villageName: string;
  districtName: string;
  regencyName: string;
  provinceName: string;
}): string {
  const street = parts.street.trim();
  return [street, parts.villageName, parts.districtName, parts.regencyName, parts.provinceName]
    .filter(Boolean)
    .join(", ");
}
