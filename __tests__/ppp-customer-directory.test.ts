import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPppCustomerDirectory,
  normalizeCustomerPhone,
  parseCsv,
} from "@/lib/ppp-customer-directory";

describe("ppp customer directory", () => {
  it("normalizes doubled leading zero and country code", () => {
    expect(normalizeCustomerPhone("0082332819674")).toBe("082332819674");
    expect(normalizeCustomerPhone("628123456789")).toBe("08123456789");
    expect(normalizeCustomerPhone("08123456789")).toBe("08123456789");
    expect(normalizeCustomerPhone("")).toBe("-");
  });

  it("keeps the first row when a username is repeated", () => {
    const directory = buildPppCustomerDirectory(
      [
        "pelanggan,profile,username,no_wa,alamat",
        "PERTAMA,PAKET,user@a,081111,Alamat A",
        "KEDUA,PAKET,user@a,082222,Alamat B",
      ].join("\n")
    );
    expect(directory.get("user@a")).toEqual({
      nama: "PERTAMA",
      nomor: "081111",
      alamat: "Alamat A",
    });
  });

  it("reads the giri file and matches username", () => {
    const csv = fs.readFileSync(
      path.join(process.cwd(), "pelanggan-giri.csv"),
      "utf8"
    );
    const parsed = parseCsv(csv);
    const directory = buildPppCustomerDirectory(csv);
    expect(parsed.length).toBeGreaterThan(500);
    expect(directory.size).toBeGreaterThan(500);
    expect(directory.get("amalia_hadad@rwijaya")).toEqual({
      nama: "AMALIA HADAD",
      nomor: "082332819674",
      alamat: "Jl. Raden WIjaya Giri",
    });
    expect(directory.get("edi_motor")?.nomor).toBe("08580000000");
    for (const row of directory.values()) {
      expect(row.nama.length).toBeLessThanOrEqual(191);
      expect(row.nomor.length).toBeLessThanOrEqual(191);
      expect(row.alamat.length).toBeLessThanOrEqual(191);
    }
  });
});
