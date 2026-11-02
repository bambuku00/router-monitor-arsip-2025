import type { Prisma } from "@prisma/client";

export type IsolirPelangganFilter = "semua" | "isolir" | "aktif";

export function parseIsolirPelangganFilter(
  raw: string | null | undefined
): IsolirPelangganFilter {
  if (raw === "isolir" || raw === "aktif") return raw;
  return "semua";
}

type RouterIsolirProfile = { id: number; isolirProfileName: string | null };

/** Klausa Prisma: pelanggan aktif dengan PPP isolir (selaras `lib/ppp-isolir`). */
export function buildPelangganIsolirPrismaWhere(
  routers: RouterIsolirProfile[]
): Prisma.PelangganWhereInput {
  const profileMatches: Prisma.PelangganWhereInput[] = routers
    .filter((r) => r.isolirProfileName?.trim())
    .map((r) => ({
      routerId: r.id,
      ppp_secret: { is: { profile: r.isolirProfileName!.trim() } },
    }));

  return {
    stop: false,
    ppp_secret: { isNot: null },
    OR: [
      { ppp_secret: { is: { isIsolir: true } } },
      { ppp_secret: { is: { disabled: "true" } } },
      ...profileMatches,
    ],
  };
}

export function pelangganIsolirFilterClause(
  filter: IsolirPelangganFilter,
  routers: RouterIsolirProfile[]
): Prisma.PelangganWhereInput | null {
  if (filter === "semua") return null;
  const isolirWhere = buildPelangganIsolirPrismaWhere(routers);
  if (filter === "isolir") return isolirWhere;
  return {
    stop: false,
    NOT: isolirWhere,
  };
}

/** Pelanggan benar-benar ikut jadwal auto isolir (mitra aktif + tanggal terisi). */
export function pelangganIkutAutoIsolir(
  tglIsolir: number | null | undefined,
  autoIsolirEnabled: boolean
): boolean {
  return autoIsolirEnabled && tglIsolir != null && tglIsolir >= 1;
}
