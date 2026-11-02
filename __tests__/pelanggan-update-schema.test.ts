import { describe, expect, it } from "vitest";
import { PelangganUpdateSchema } from "@/lib/pelanggan-update-schema";

describe("PelangganUpdateSchema", () => {
  it("accepts stop-only payload", () => {
    const result = PelangganUpdateSchema.safeParse({
      stop: true,
      tgl_stop: "2026-07-23",
    });
    expect(result.success).toBe(true);
  });

  it("accepts resume-only payload", () => {
    const result = PelangganUpdateSchema.safeParse({
      stop: false,
      tgl_stop: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts full edit payload with null alamat/email", () => {
    const result = PelangganUpdateSchema.safeParse({
      nama: "Test",
      alamat: null,
      nomor: "08123456789",
      email: null,
      tgl: "2026-01-01",
      paketId: 1,
      lat: null,
      lng: null,
      tgl_isolir: null,
      stop: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts form-like payload with extra keys stripped", () => {
    const result = PelangganUpdateSchema.safeParse({
      id: 1,
      ppp_secretId: 29175,
      routerId: 5,
      nama: "Test",
      alamat: "",
      nomor: "08123456789",
      email: "",
      tgl: "2026-01-01",
      paketId: 1,
      lat: null,
      lng: null,
      tgl_isolir: null,
      stop: false,
    });
    expect(result.success).toBe(true);
  });
});
