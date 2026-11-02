import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  auditLogKeterangan,
  auditOutcomeLabel,
  mapIsolirActivity,
  mapPaymentActivity,
  mapSubscriptionActivity,
  mergeActivityWindow,
} from "@/lib/audit-log-label";

describe("audit log label", () => {
  it("uses Indonesian names for stored actions", () => {
    expect(auditActionLabel("login")).toBe("Login");
    expect(auditActionLabel("logout")).toBe("Logout");
    expect(auditActionLabel("ppp_auto_fill_daily")).toBe("Auto isi PPPoE");
    expect(auditActionLabel("ppp_package_changed")).toBe("Ganti paket");
    expect(auditActionLabel("pelanggan_baru")).toBe("Pelanggan baru");
    expect(auditOutcomeLabel("denied")).toBe("Ditolak");
  });

  it("summarizes auto-fill without dumping the raw payload", () => {
    expect(
      auditLogKeterangan({
        action: "ppp_auto_fill_daily",
        reason: "router:4",
        meta: { routerId: 4, created: 2, linked: 1, skips: { duplicate_customer: 1 } },
      })
    ).toBe("Router 4, dibuat 2, ditautkan 1");
  });

  it("keeps the stored reason for quota changes", () => {
    expect(
      auditLogKeterangan({
        action: "free_customer_limit_changed",
        reason: "Kuota pelanggan gratis mitra: Unlimited → 10",
        meta: { oldLimit: null, newLimit: 10 },
      })
    ).toBe("Kuota pelanggan gratis mitra: Unlimited → 10");
    expect(
      auditLogKeterangan({
        action: "ppp_package_changed",
        reason: "Demo · ppp1 · 5Mbps → 10Mbps",
        meta: { actorUserId: 2 },
      })
    ).toBe("Demo · ppp1 · 5Mbps → 10Mbps");
  });

  it("labels isolir and payment cancellation from the stored rows", () => {
    const isolir = mapIsolirActivity({
      id: 4,
      created: new Date("2026-10-20T03:00:00.000Z"),
      action: "isolate",
      status: "success",
      executedBy: "system",
      dryRun: false,
      pppUsername: "ppp1",
      oldProfile: "default",
      newProfile: "isolir",
      errorMessage: null,
      pelangganNama: "Demo",
      dueDate: "2026-10-20",
    });
    expect(isolir.actionLabel).toBe("Isolir");
    expect(isolir.pelaku).toBe("Sistem (otomatis)");
    expect(isolir.keterangan).toBe(
      "Demo · ppp1 · jatuh tempo 2026-10-20 · default → isolir"
    );

    const cancel = mapPaymentActivity({
      id: 9,
      created: new Date("2026-10-21T03:00:00.000Z"),
      status: "Belum",
      total: 150000,
      metode: null,
      noInvoice: "000123",
      pelangganNama: "Demo",
      jatuhTempo: "2026-10-20",
      pelaku: "Budi (admin)",
    });
    expect(cancel.actionLabel).toBe("Pembatalan");
    expect(cancel.pelaku).toBe("Budi (admin)");
    expect(cancel.keterangan).toContain("INV 000123");
    expect(cancel.keterangan).toContain("Rp 150.000");

    const stop = mapSubscriptionActivity({
      id: 3,
      created: new Date("2026-10-22T03:00:00.000Z"),
      action: "stop",
      executedBy: "Budi (admin)",
      pelangganNama: "Demo",
      pppUsername: "ppp1",
    });
    expect(stop.actionLabel).toBe("Berhenti");
    expect(stop.pelaku).toBe("Budi (admin)");
    expect(stop.keterangan).toBe("Demo · ppp1");

    const resume = mapSubscriptionActivity({
      id: 4,
      created: new Date("2026-10-23T03:00:00.000Z"),
      action: "resume",
      executedBy: "system",
      pelangganNama: "Demo",
      pppUsername: null,
    });
    expect(resume.actionLabel).toBe("Lanjut berlangganan");
    expect(resume.pelaku).toBe("Sistem (otomatis)");
  });

  it("pages mixed logs by newest time", () => {
    const older = { id: "audit:1", created: new Date("2026-10-01T00:00:00.000Z") };
    const newer = { id: "bayar:2", created: new Date("2026-10-02T00:00:00.000Z") };
    const mid = { id: "isolir:3", created: new Date("2026-10-01T12:00:00.000Z") };
    expect(mergeActivityWindow([[older], [newer], [mid]], 1, 2).map((row) => row.id)).toEqual([
      "bayar:2",
      "isolir:3",
    ]);
  });
});
