import { normalizePaketProfileName } from "@/lib/ppp-bulk-fill-resolve-paket";

function profileOnRouter(name: string, routerProfiles: string[]): string | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  for (const profile of routerProfiles) {
    const trimmed = profile.trim();
    if (trimmed.toLowerCase() === needle) return trimmed;
  }
  return null;
}

export type PackageChangeDirection = "upgrade" | "downgrade";

export type PackageChangePaket = {
  id: number;
  nama: string;
  kapasitas: number;
  harga: number;
};

export type PackageChangeTarget = PackageChangePaket & {
  profile: string;
};

function rankDelta(candidate: PackageChangePaket, current: PackageChangePaket): number {
  const kapasitas = candidate.kapasitas - current.kapasitas;
  if (Math.abs(kapasitas) > 0.0001) return kapasitas;
  return candidate.harga - current.harga;
}

/** Paket di atas atau di bawah paket sekarang. Profil Mikrotik memakai ejaan router bila namanya sama. */
export function listPackageChangeTargets(params: {
  direction: PackageChangeDirection;
  current: PackageChangePaket;
  pakets: PackageChangePaket[];
  routerProfiles: string[];
  isolirProfileName?: string | null;
}): PackageChangeTarget[] {
  const isolir = params.isolirProfileName?.trim().toLowerCase() ?? "";
  const targets: PackageChangeTarget[] = [];

  for (const paket of params.pakets) {
    if (paket.id === params.current.id) continue;
    const delta = rankDelta(paket, params.current);
    if (params.direction === "upgrade" && delta <= 0) continue;
    if (params.direction === "downgrade" && delta >= 0) continue;

    const normalized = normalizePaketProfileName(paket.nama);
    if (!normalized) continue;
    if (isolir && normalized === isolir) continue;

    const profile = profileOnRouter(paket.nama, params.routerProfiles) ?? paket.nama.trim();
    if (isolir && profile.toLowerCase() === isolir) continue;

    targets.push({ ...paket, profile });
  }

  targets.sort((a, b) => {
    const left = rankDelta(a, params.current);
    const right = rankDelta(b, params.current);
    return params.direction === "upgrade" ? left - right : right - left;
  });
  return targets;
}
