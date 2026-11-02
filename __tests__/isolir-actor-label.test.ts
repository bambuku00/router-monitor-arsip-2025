import { describe, expect, it } from "vitest";
import {
  formatIsolirActor,
  formatIsolirLogActor,
  formatIsolirOlehLabel,
  formatIsolirOlehShort,
  jakartaMonthRange,
} from "@/lib/isolir-actor-label";

describe("isolir actor label", () => {
  it("menulis nama dan username pelaku", () => {
    expect(formatIsolirActor({ nama: "Budi", user: "admin" })).toBe(
      "Budi (admin)"
    );
  });

  it("mengganti system menjadi keterangan otomatis", () => {
    expect(formatIsolirOlehLabel("system")).toBe("Sistem (otomatis)");
    expect(formatIsolirOlehLabel("Budi (admin)")).toBe("Budi (admin)");
    expect(formatIsolirOlehLabel("dry-run")).toBeNull();
    expect(formatIsolirLogActor("system")).toBe("Sistem (otomatis)");
    expect(formatIsolirLogActor("Budi (admin)")).toBe("Budi (admin)");
    expect(formatIsolirLogActor("dry-run", true)).toBe("Uji coba");
  });

  it("menyingkat pelaku menjadi nama saja", () => {
    expect(formatIsolirOlehShort("DEMO (admin)")).toBe("DEMO");
    expect(formatIsolirOlehShort("system")).toBe("Sistem");
  });

  it("membatasi catatan buka isolir pada bulan tagihan", () => {
    const range = jakartaMonthRange("2026-10");
    expect(range?.start.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(range?.end.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(jakartaMonthRange("2026-13")).toBeNull();
  });
});
