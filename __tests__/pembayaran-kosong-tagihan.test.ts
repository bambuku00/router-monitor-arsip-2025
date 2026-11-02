import { describe, expect, it } from "vitest";
import {
  classifyKosongTagihan,
  isolirSudahLebihDariSebulan,
  openIsolirStartedAt,
} from "@/lib/pembayaran-pelanggan-bayar-filter";

const now = new Date(2026, 9, 26);
const mode = {
  billingStartMode: "NEXT_MONTH" as const,
  billingStartDate: null,
};

describe("classifyKosongTagihan", () => {
  it("keeps a new install without any invoice in belum waktunya", () => {
    expect(
      classifyKosongTagihan({
        tgl: "2026-10-18",
        period: "2026-10",
        ...mode,
        hasAnyInvoice: false,
        hasInvoiceNextMonth: false,
        isolirStartedAt: null,
        now,
      })
    ).toBe("belum_waktunya");
  });

  it("keeps the first billing month of a new install out of tanpa tagihan", () => {
    expect(
      classifyKosongTagihan({
        tgl: "2026-10-18",
        period: "2026-11",
        ...mode,
        hasAnyInvoice: false,
        hasInvoiceNextMonth: false,
        isolirStartedAt: null,
        now,
      })
    ).toBe("belum_waktunya");
  });

  it("puts an established customer missing this month into tanpa tagihan", () => {
    expect(
      classifyKosongTagihan({
        tgl: "2020-01-01",
        period: "2026-10",
        ...mode,
        hasAnyInvoice: true,
        hasInvoiceNextMonth: false,
        isolirStartedAt: null,
        now,
      })
    ).toBe("tanpa_tagihan");
  });

  it("does not put a long isolir without next month invoice into belum waktunya", () => {
    expect(
      classifyKosongTagihan({
        tgl: "2026-10-18",
        period: "2026-10",
        ...mode,
        hasAnyInvoice: false,
        hasInvoiceNextMonth: false,
        isolirStartedAt: new Date(2026, 7, 1),
        isIsolir: true,
        now,
      })
    ).toBeNull();
  });

  it("keeps an isolir customer out of belum waktunya even when the isolir is recent", () => {
    expect(
      classifyKosongTagihan({
        tgl: "2026-10-18",
        period: "2026-10",
        ...mode,
        hasAnyInvoice: false,
        hasInvoiceNextMonth: false,
        isolirStartedAt: new Date(2026, 9, 21),
        isIsolir: true,
        now,
      })
    ).toBeNull();
  });

  it("keeps an isolir customer out of belum waktunya when next month still has an invoice", () => {
    expect(
      classifyKosongTagihan({
        tgl: "2026-10-18",
        period: "2026-10",
        ...mode,
        hasAnyInvoice: false,
        hasInvoiceNextMonth: true,
        isolirStartedAt: new Date(2026, 7, 1),
        isIsolir: true,
        now,
      })
    ).toBeNull();
  });

  it("keeps an established isolir who is missing this month out of the other empty chips", () => {
    expect(
      classifyKosongTagihan({
        tgl: "2020-01-01",
        period: "2026-10",
        ...mode,
        hasAnyInvoice: true,
        hasInvoiceNextMonth: true,
        isolirStartedAt: new Date(2026, 9, 20),
        isIsolir: true,
        now,
      })
    ).toBeNull();
  });
});

describe("isolirSudahLebihDariSebulan", () => {
  it("is true after more than 30 days and false on a recent isolir", () => {
    expect(isolirSudahLebihDariSebulan(new Date(2026, 7, 1), now)).toBe(true);
    expect(isolirSudahLebihDariSebulan(new Date(2026, 9, 21), now)).toBe(false);
    expect(isolirSudahLebihDariSebulan(null, now)).toBe(false);
  });
});

describe("openIsolirStartedAt", () => {
  it("uses the isolate that is still open", () => {
    const started = openIsolirStartedAt([
      { action: "isolate", created: new Date(2026, 6, 1) },
      { action: "restore", created: new Date(2026, 7, 1) },
      { action: "isolate", created: new Date(2026, 8, 2) },
    ]);
    expect(started?.toISOString()).toBe(new Date(2026, 8, 2).toISOString());
  });
});
