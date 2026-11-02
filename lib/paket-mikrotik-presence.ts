import { normalizePaketProfileName } from "@/lib/ppp-bulk-fill-resolve-paket";

export type RouterProfileNames = {
  nama: string;
  userId: number;
  names: ReadonlySet<string>;
};

export function routerNamesForPaket(
  paket: { nama: string; userId: number },
  routers: readonly RouterProfileNames[]
): string[] {
  const name = normalizePaketProfileName(paket.nama);
  if (!name) return [];
  return routers
    .filter((router) => router.userId === paket.userId && router.names.has(name))
    .map((router) => router.nama);
}

export type PaketPresenceRow = {
  id: number;
  nama: string;
  userId: number;
  pelangganCount: number;
};

/**
 * profilesByOwner hanya berisi pemilik yang profilnya sudah terbaca.
 * Set kosong berarti router ada tetapi tidak punya profil, atau pemilik tidak punya router.
 */
export function classifyPaketsMissingFromMikrotik(params: {
  pakets: PaketPresenceRow[];
  profilesByOwner: ReadonlyMap<number, ReadonlySet<string>>;
  ownersWithFailedRouter: ReadonlySet<number>;
}): {
  deletable: PaketPresenceRow[];
  usedMissing: PaketPresenceRow[];
} {
  const deletable: PaketPresenceRow[] = [];
  const usedMissing: PaketPresenceRow[] = [];

  for (const paket of params.pakets) {
    if (params.ownersWithFailedRouter.has(paket.userId)) continue;
    const profiles = params.profilesByOwner.get(paket.userId);
    if (!profiles) continue;
    const name = normalizePaketProfileName(paket.nama);
    if (!name || profiles.has(name)) continue;
    if (paket.pelangganCount > 0) usedMissing.push(paket);
    else deletable.push(paket);
  }

  return { deletable, usedMissing };
}
