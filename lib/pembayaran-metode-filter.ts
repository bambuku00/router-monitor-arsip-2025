export const METODE_BAYAR_FILTERS = ["Cash", "Transfer"] as const;

export type MetodeBayarFilter = (typeof METODE_BAYAR_FILTERS)[number];

export function parseMetodeBayarFilter(
  raw: string | null | undefined
): MetodeBayarFilter | null {
  if (raw === "Cash" || raw === "Transfer") return raw;
  return null;
}
