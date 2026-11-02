import { isPaketGratisByHarga } from "@/lib/pelanggan-billing-category";

export type BulkFillPaketRow = {
  id: number;
  nama: string;
  harga: number;
};

export type BulkFillMode = "manual" | "automatic";

export type BulkFillPaketSkipReason =
  | "no_active_package"
  | "package_profile_mismatch"
  | "free_package_not_allowed_as_fallback"
  | "ambiguous_package_profile";

export type ResolvePaketForAutoFillResult =
  | {
      ok: true;
      paket: BulkFillPaketRow;
      method: "exact_match" | "single_paid_fallback" | "manual_default";
    }
  | { ok: false; reason: BulkFillPaketSkipReason };

/** Normalisasi nama profil/paket: trim + lowercase (exact match, bukan partial). */
export function normalizePaketProfileName(name: string): string {
  return name.trim().toLowerCase();
}

/** Nama paket aktif yang duplikat setelah normalisasi (hanya string normalisasi, tanpa data sensitif). */
export function findDuplicateNormalizedPaketNames(
  pakets: BulkFillPaketRow[]
): string[] {
  const counts = new Map<string, number>();
  for (const p of pakets) {
    const key = normalizePaketProfileName(p.nama);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name);
}

export function buildAmbiguousNormalizedNameSet(
  pakets: BulkFillPaketRow[]
): Set<string> {
  return new Set(findDuplicateNormalizedPaketNames(pakets));
}

/** Label tampilan untuk nama paket duplikat (nama asli pertama per kelompok normalisasi). */
export function duplicatePaketDisplayLabels(
  pakets: BulkFillPaketRow[]
): string[] {
  const dupKeys = buildAmbiguousNormalizedNameSet(pakets);
  if (dupKeys.size === 0) return [];

  const seen = new Set<string>();
  const labels: string[] = [];
  for (const p of pakets) {
    const key = normalizePaketProfileName(p.nama);
    if (dupKeys.has(key) && !seen.has(key)) {
      seen.add(key);
      labels.push(p.nama.trim());
    }
  }
  return labels.sort((a, b) => a.localeCompare(b, "id"));
}

export function resolvePaketForAutoFill(params: {
  profile: string;
  pakets: BulkFillPaketRow[];
  mode: BulkFillMode;
  defaultPaketId?: number;
  ambiguousNormalizedNames?: Set<string>;
}): ResolvePaketForAutoFillResult {
  const { profile, pakets, mode, defaultPaketId } = params;

  if (pakets.length === 0) {
    return { ok: false, reason: "no_active_package" };
  }

  const ambiguous =
    params.ambiguousNormalizedNames ??
    buildAmbiguousNormalizedNameSet(pakets);

  const normalizedProfile = normalizePaketProfileName(profile);
  const exactMatches = pakets.filter(
    (p) => normalizePaketProfileName(p.nama) === normalizedProfile
  );

  if (exactMatches.length > 1) {
    return { ok: false, reason: "ambiguous_package_profile" };
  }

  if (exactMatches.length === 1) {
    if (ambiguous.has(normalizedProfile)) {
      return { ok: false, reason: "ambiguous_package_profile" };
    }
    return { ok: true, paket: exactMatches[0], method: "exact_match" };
  }

  // Tidak ada exact match
  if (pakets.length === 1) {
    const only = pakets[0];
    if (isPaketGratisByHarga(only.harga)) {
      return { ok: false, reason: "free_package_not_allowed_as_fallback" };
    }
    return { ok: true, paket: only, method: "single_paid_fallback" };
  }

  if (mode === "manual" && defaultPaketId != null) {
    const chosen = pakets.find((p) => p.id === defaultPaketId);
    if (!chosen) {
      return { ok: false, reason: "package_profile_mismatch" };
    }
    return { ok: true, paket: chosen, method: "manual_default" };
  }

  return { ok: false, reason: "package_profile_mismatch" };
}
