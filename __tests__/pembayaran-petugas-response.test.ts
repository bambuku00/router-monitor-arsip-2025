import { describe, expect, it } from "vitest";

import { canBulkMarkPembayaranPelanggan } from "@/lib/staff-permissions";
import {
  cetakDataForAudience,
  hidesMitraDirectory,
  pelangganListExtrasForAudience,
  pppSecretForAudience,
  showsPppUsername,
  statusActorsForAudience,
  tagihanPayloadForAudience,
  tagihanServiceDescription,
  valuesForAudience,
  visibleInputter,
} from "@/lib/pembayaran-petugas-response";

const staff = {
  id: 7,
  nama: "Kasir",
  user: "kasir01",
  role: "Keuangan" as const,
};

const inputters = [staff];
const routers = [{ id: 3, nama: "Router Utara" }];
const processedDays = ["2026-10-02", "2026-10-18"];
const ppp = { total: 40, belumInput: 5, tagihan: 30 };
const regulatory = { bhpPercent: 0.5, usoPercent: 1.25, bhpAmount: 9000 };
const assignedCustomer = {
  nama: "Pelanggan A",
  alamat: "Jl. Mawar",
  nomor: "081200000000",
  router: { id: 3, nama: "Router Utara", isolirProfileName: "isolir-profile" },
  pembayaran: [{ id: 9, status: "Belum", total: 100000 }],
  isolirOleh: "Admin (admin01)",
  bukaIsolirOleh: "Teknisi (tek01)",
  berhentiOleh: "Keuangan (kasir01)",
  lanjutOleh: "Superadmin (root)",
};

const stat = {
  total: 300000,
  belum: 100000,
  terbayar: 200000,
  ppnPercent: 11,
  pendapatan: 150000,
  kantor: 20000,
  mitra: 80000,
};

describe("payload daftar pembayaran untuk Petugas", () => {
  it("tidak mengirim inputter global, router mitra, atau hari proses global", () => {
    expect(hidesMitraDirectory("Petugas")).toBe(true);
    expect(valuesForAudience("Petugas", inputters)).toEqual([]);
    expect(valuesForAudience("Petugas", routers)).toEqual([]);
    expect(valuesForAudience("Petugas", processedDays)).toEqual([]);
  });

  it("tidak mengirim username dan role staf pada tagihan", () => {
    expect(visibleInputter("Petugas", staff)).toEqual({ id: 7, nama: "Kasir" });
    expect(visibleInputter("Petugas", null)).toBeNull();
  });

  it("tagihan hanya berisi kartu tugasnya, tanpa PPP mitra dan regulasi", () => {
    expect(tagihanPayloadForAudience("Petugas", stat, regulatory, ppp)).toEqual({
      total: 300000,
      belum: 100000,
      terbayar: 200000,
      tunai: 0,
      transfer: 0,
      jumlahTunai: 0,
      jumlahTransfer: 0,
      regulatory: null,
      ppp: null,
    });
  });

  it("tetap menyimpan nominal tagihan yang dipakai untuk membayar", () => {
    const payload = tagihanPayloadForAudience("Petugas", stat, regulatory, ppp);
    expect(payload.total).toBe(300000);
    expect(payload.belum).toBe(100000);
    expect(payload.terbayar).toBe(200000);
    expect(payload).not.toHaveProperty("autoIsolirEnabled");
  });

  it("mengosongkan pelaku isolir dan tidak mengirim auto isolir", () => {
    const row = statusActorsForAudience("Petugas", assignedCustomer);
    expect(row.isolirOleh).toBeNull();
    expect(row.bukaIsolirOleh).toBeNull();
    expect(row.berhentiOleh).toBeNull();
    expect(row.lanjutOleh).toBeNull();
    expect(row.nama).toBe("Pelanggan A");
    expect(row.alamat).toBe("Jl. Mawar");
    expect(row.pembayaran).toEqual([{ id: 9, status: "Belum", total: 100000 }]);
    expect(row.router.isolirProfileName).toBe("isolir-profile");

    const extras = pelangganListExtrasForAudience("Petugas", {
      mitraPpn: 11,
      autoIsolirEnabled: true,
    });
    expect(extras.mitraPpn).toBe(11);
    expect(extras).not.toHaveProperty("autoIsolirEnabled");
  });

  it("tidak menerima atau menampilkan username PPPoE", () => {
    const secret = pppSecretForAudience("Petugas", {
      name: "user.pppoe",
      profile: "10Mbps",
      isIsolir: false,
    });
    expect(showsPppUsername("Petugas")).toBe(false);
    expect(secret).toEqual({ profile: "10Mbps", isIsolir: false });
    expect(secret).not.toHaveProperty("name");

    const cetak = cetakDataForAudience("Petugas", {
      belum: [
        {
          pelanggan: {
            nama: "Pelanggan A",
            ppp_secret: { name: "user.pppoe" },
          },
        },
      ],
      terbayar: [],
    });
    expect(cetak.belum[0]?.pelanggan.nama).toBe("Pelanggan A");
    expect(cetak.belum[0]?.pelanggan.ppp_secret).toBeNull();
    expect(
      tagihanServiceDescription("Petugas", "Router Utara", "user.pppoe", "Oktober 2026")
    ).toBe("Tagihan internet Router Utara — periode Oktober 2026");
  });
});

describe("payload daftar pembayaran untuk peran staf", () => {
  it.each(["Admin", "Superadmin", "Keuangan", "Teknisi"] as const)(
    "%s tetap menerima inputter, router, hari proses, PPP, dan regulasi",
    (role) => {
      expect(hidesMitraDirectory(role)).toBe(false);
      expect(valuesForAudience(role, inputters)).toEqual(inputters);
      expect(valuesForAudience(role, routers)).toEqual(routers);
      expect(valuesForAudience(role, processedDays)).toEqual(processedDays);
      expect(visibleInputter(role, staff)).toEqual(staff);
      expect(tagihanPayloadForAudience(role, stat, regulatory, ppp)).toMatchObject({
        ...stat,
        regulatory,
        ppp,
      });
      expect(canBulkMarkPembayaranPelanggan({ role })).toBe(true);
      expect(showsPppUsername(role)).toBe(true);
      expect(
        pppSecretForAudience(role, {
          name: "user.pppoe",
          profile: "10Mbps",
        })
      ).toEqual({ name: "user.pppoe", profile: "10Mbps" });
      expect(
        tagihanServiceDescription(role, "Router Utara", "user.pppoe", "Oktober 2026")
      ).toBe("Tagihan internet Router Utara — PPP user.pppoe — periode Oktober 2026");
      expect(statusActorsForAudience(role, assignedCustomer)).toEqual(
        assignedCustomer
      );
      expect(
        pelangganListExtrasForAudience(role, {
          mitraPpn: 11,
          autoIsolirEnabled: true,
        })
      ).toEqual({ mitraPpn: 11, autoIsolirEnabled: true });
    }
  );

  it("tidak merender aksi bayar massal untuk Petugas", () => {
    expect(canBulkMarkPembayaranPelanggan({ role: "Petugas" })).toBe(false);
    expect(canBulkMarkPembayaranPelanggan(null)).toBe(false);
  });
});
