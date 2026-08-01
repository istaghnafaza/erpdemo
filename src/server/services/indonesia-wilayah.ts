// =============================================================================
// Indonesia wilayah — server-side proxy (avoids browser CORS on wilayah.id)
// =============================================================================

export interface WilayahItem {
  code: string;
  name: string;
}

const BASE = "https://wilayah.id/api";

const ALLOWED_PATH =
  /^\/(provinces\.json|regencies\/[\d.]+\.json|districts\/[\d.]+\.json|villages\/[\d.]+\.json)$/;

export function isAllowedWilayahPath(path: string): boolean {
  return ALLOWED_PATH.test(path);
}

export async function fetchWilayahFromApi(path: string): Promise<WilayahItem[]> {
  if (!isAllowedWilayahPath(path)) {
    throw new Error("Path wilayah tidak valid");
  }

  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error("Gagal memuat data wilayah");
  }

  const json = (await res.json()) as { data?: WilayahItem[] };
  return json.data ?? [];
}
