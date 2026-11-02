import { describe, expect, it } from "vitest";
import { bagiPendapatanBersihMitraKantor } from "@/lib/pembayaran-split";

describe("bagiPendapatanBersihMitraKantor", () => {
  it("splits by mitra percent when revenue share is on", () => {
    expect(bagiPendapatanBersihMitraKantor(1_000_000, 60, true)).toEqual({
      mitra: 600_000,
      kantor: 400_000,
    });
  });

  it("gives the net amount to the account and nothing to the office when share is off", () => {
    expect(bagiPendapatanBersihMitraKantor(1_000_000, 60, false)).toEqual({
      mitra: 1_000_000,
      kantor: 0,
    });
  });
});
