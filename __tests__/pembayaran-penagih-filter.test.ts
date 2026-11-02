import { describe, expect, it } from "vitest";

import {
  parsePenagihPelangganFilter,
  pelangganPenagihFilterClause,
} from "@/lib/pembayaran-penagih-filter";

describe("pelangganPenagihFilterClause", () => {
  it("hanya pelanggan yang punya penagih saat filter ada", () => {
    expect(parsePenagihPelangganFilter("ada")).toEqual({ kind: "ada" });
    expect(pelangganPenagihFilterClause({ kind: "ada" }, new Set())).toEqual({
      penagihPenugasan: { isNot: null },
    });
  });
});
