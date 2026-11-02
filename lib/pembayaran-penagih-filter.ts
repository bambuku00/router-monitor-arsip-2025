import type { Prisma } from "@prisma/client";

export type PenagihPelangganFilter =
  | { kind: "semua" }
  | { kind: "ada" }
  | { kind: "tanpa" }
  | { kind: "id"; id: number };

export function parsePenagihPelangganFilter(
  raw: string | null | undefined
): PenagihPelangganFilter {
  if (raw === "tanpa") return { kind: "tanpa" };
  if (raw === "ada") return { kind: "ada" };
  const id = parseInt(raw ?? "", 10);
  if (Number.isInteger(id) && id > 0) return { kind: "id", id };
  return { kind: "semua" };
}

export function pelangganPenagihFilterClause(
  filter: PenagihPelangganFilter,
  allowedIds: ReadonlySet<number>
): Prisma.PelangganWhereInput | null {
  if (filter.kind === "tanpa") return { penagihPenugasan: { is: null } };
  if (filter.kind === "ada") return { penagihPenugasan: { isNot: null } };
  if (filter.kind === "id") {
    if (!allowedIds.has(filter.id)) return { id: { in: [] } };
    return { penagihPenugasan: { is: { penagihId: filter.id } } };
  }
  return null;
}
