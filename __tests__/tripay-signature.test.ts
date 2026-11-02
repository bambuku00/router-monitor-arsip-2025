import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  formatPembayaranProcessorLabel,
  pembayaranLunasLewatTripay,
} from "@/lib/pembayaran-inputter";
import {
  tripayCallbackAmountMatches,
  tripayCallbackSignature,
  tripayCreateSignature,
  tripayExpiredSeconds,
  tripaySignaturesMatch,
} from "@/lib/tripay";

describe("tripay signatures", () => {
  it("signs a closed transaction with merchant code, ref, and amount", () => {
    const signature = tripayCreateSignature("T1234", "INV000001", 150000, "secret");
    const expected = createHmac("sha256", "secret")
      .update("T1234INV000001150000")
      .digest("hex");
    expect(signature).toBe(expected);
    expect(tripaySignaturesMatch(signature, expected)).toBe(true);
    expect(tripaySignaturesMatch(signature, `${expected}00`)).toBe(false);
  });

  it("accepts the invoice amount from a callback body", () => {
    const raw = JSON.stringify({ merchant_ref: "INV1", total_amount: 50000, status: "PAID" });
    const signature = tripayCallbackSignature(raw, "secret");
    expect(tripaySignaturesMatch(signature, tripayCallbackSignature(raw, "secret"))).toBe(true);
    expect(tripayCallbackAmountMatches({ total_amount: 50000 }, 50000)).toBe(true);
    expect(tripayCallbackAmountMatches({ total_amount: 51000, fee_customer: 1000 }, 50000)).toBe(
      true
    );
    expect(tripayCallbackAmountMatches({ total_amount: 51000 }, 50000)).toBe(false);
  });

  it("keeps QRIS ShopeePay inside the one-hour expiry limit", () => {
    expect(tripayExpiredSeconds("QRIS_SHOPEEPAY")).toBe(60 * 60);
    expect(tripayExpiredSeconds("BRIVA")).toBe(24 * 60 * 60);
  });

  it("labels a Tripay callback as Tripay when the payment log is written with it", () => {
    const paidAt = new Date("2026-10-21T00:40:00.000Z");
    const logAt = new Date(paidAt.getTime() + 2000);
    expect(pembayaranLunasLewatTripay(logAt, paidAt)).toBe(true);
    expect(
      pembayaranLunasLewatTripay(new Date(paidAt.getTime() + 60 * 60 * 1000), paidAt)
    ).toBe(false);
    expect(
      formatPembayaranProcessorLabel(
        { id: 1, nama: "Mitra Uji", user: "admin", role: "Admin" },
        true
      )
    ).toBe("Tripay");
  });
});
