import { describe, expect, it } from "vitest";
import {
  filterCashRows,
  filterTransferRows,
  namaPelakuCash,
  paginateTransferRows,
  sortTransferRows,
  summarizeCashOrang,
  summarizeTransfers,
  transferBankLabel,
  type LabeledPembukuanTransfer,
} from "@/lib/pembukuan-transfer";

const rows: LabeledPembukuanTransfer[] = [
  {
    id: 1,
    pembayarKey: "p:10",
    nama: "Ani",
    pppoe: "ani-01",
    bank: "BRI",
    nominal: 150000,
    periode: "2026-10-05",
    pemroses: "Sari (Admin)",
    diprosesPada: "5 Oktober 2026, 08.15",
  },
  {
    id: 2,
    pembayarKey: "p:11",
    nama: "Budi",
    pppoe: "budi-02",
    bank: "BCA",
    nominal: 200000,
    periode: "2026-10-02",
    pemroses: "Tripay",
    diprosesPada: "2 Oktober 2026, 09.00",
  },
  {
    id: 3,
    pembayarKey: "p:10",
    nama: "Ani",
    pppoe: "ani-01",
    bank: "BRI",
    nominal: 150000,
    periode: "2026-09-05",
    pemroses: "Sari (Admin)",
    diprosesPada: "5 September 2026, 10.00",
  },
];

describe("pembukuan transfer research", () => {
  it("labels a stored bank, Tripay, and a transfer without a bank", () => {
    expect(transferBankLabel({ bankName: " BRI " })).toBe("BRI");
    expect(transferBankLabel({ bankName: "BCA", norek: " 111 " })).toBe(
      "BCA · 111"
    );
    expect(transferBankLabel({ bankName: "BCA", norek: "222" })).toBe(
      "BCA · 222"
    );
    expect(transferBankLabel({ bankName: null, viaTripay: true })).toBe(
      "Tripay"
    );
    expect(transferBankLabel({ bankName: null, viaTripay: false })).toBe(
      "Belum dicatat"
    );
  });

  it("keeps two accounts of the same bank separate", () => {
    const summary = summarizeTransfers([
      { ...rows[1], id: 4, bank: "BCA · 111", nominal: 100000 },
      { ...rows[1], id: 5, bank: "BCA · 222", nominal: 50000 },
    ]);
    expect(summary.banks.map((bank) => bank.bank)).toEqual([
      "BCA · 111",
      "BCA · 222",
    ]);
  });

  it("groups money by destination bank and counts distinct payers", () => {
    const summary = summarizeTransfers(rows);
    expect(summary.jumlah).toBe(3);
    expect(summary.pembayar).toBe(2);
    expect(summary.banks.map((bank) => bank.bank)).toEqual(["BRI", "BCA"]);
    expect(summary.banks[0]).toMatchObject({ jumlah: 2, total: 300000 });
  });

  it("filters by payer or bank and keeps the newest period first", () => {
    const sorted = sortTransferRows(filterTransferRows(rows, "bri"));
    expect(sorted.map((row) => row.id)).toEqual([1, 3]);
    const page = paginateTransferRows(sorted, 1, 1);
    expect(page.total).toBe(2);
    expect(page.totalPages).toBe(2);
    expect(page.rows[0]?.nama).toBe("Ani");
    expect(page.rows[0]?.periode).toBe("2026-10-05");
    expect(page.rows[0]?.pppoe).toBe("ani-01");
  });

  it("keeps a clicked bank selected while the search looks inside it", () => {
    expect(filterTransferRows(rows, "", "BCA").map((row) => row.id)).toEqual([
      2,
    ]);
    expect(filterTransferRows(rows, "budi", "BRI")).toEqual([]);
  });

  it("finds a transfer by PPPoE name", () => {
    expect(filterTransferRows(rows, "budi-02").map((row) => row.id)).toEqual([
      2,
    ]);
  });

  it("sorts processor names alphabetically and newest processed time first", () => {
    const timed: LabeledPembukuanTransfer[] = [
      { ...rows[0], processedAt: "2026-10-05T01:15:00.000Z" },
      { ...rows[1], processedAt: "2026-10-20T02:00:00.000Z" },
      { ...rows[2], pemroses: "—", processedAt: null },
    ];
    expect(sortTransferRows(timed, "nama").map((row) => row.id)).toEqual([1, 2, 3]);
    expect(sortTransferRows(timed, "tanggal").map((row) => row.id)).toEqual([2, 1, 3]);
  });

  it("filters by processor name and the processed day that exists", () => {
    const withDays: LabeledPembukuanTransfer[] = [
      { ...rows[0], processedDay: 5 },
      { ...rows[1], processedDay: 2 },
      { ...rows[2], processedDay: 5 },
    ];
    expect(
      filterTransferRows(withDays, "", null, "Sari (Admin)").map((row) => row.id)
    ).toEqual([1, 3]);
    expect(filterTransferRows(withDays, "", null, null, 2).map((row) => row.id)).toEqual([
      2,
    ]);
  });

  it("groups cash payments by the person who recorded them", () => {
    const cash: LabeledPembukuanTransfer[] = [
      { ...rows[0], bank: "Cash" },
      { ...rows[2], bank: "Cash" },
      { ...rows[1], bank: "Cash", pemroses: "—" },
    ];
    expect(namaPelakuCash(cash[2])).toBe("Budi");
    const summary = summarizeCashOrang(cash);
    expect(summary.jumlah).toBe(3);
    expect(summary.total).toBe(500000);
    expect(summary.orang.map((orang) => orang.nama)).toEqual(["Sari (Admin)", "Budi"]);
    expect(filterCashRows(cash, "", "Sari (Admin)").map((row) => row.id)).toEqual([1, 3]);
    expect(filterCashRows(cash, "budi").map((row) => row.id)).toEqual([2]);
  });
});
