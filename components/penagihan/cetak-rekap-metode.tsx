"use client";

import { formatBillingPeriodLabel } from "@/lib/billing-due-date";
import type { RekapMetodeBaris } from "@/lib/penagih-rekap-metode";
import { FileSpreadsheet, Printer } from "lucide-react";

function formatIdr(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadExcel(params: {
  periodLabel: string;
  penagihNama: string;
  rows: RekapMetodeBaris[];
}) {
  const header = [
    "PAKET",
    "HARGA PAKET",
    "JUMLAH BELUM",
    "BELUM BAYAR",
    "JUMLAH SUDAH",
    "SUDAH BAYAR",
    "JUMLAH TUNAI",
    "TUNAI",
    "JUMLAH TRANSFER",
    "TRANSFER",
    "TOTAL DITAGIH",
  ];
  const lines = [
    csvCell(`${params.periodLabel} · ${params.penagihNama}`),
    header.map(csvCell).join(";"),
    ...params.rows.map((row) =>
      [
        row.nama,
        row.harga,
        row.jumlahBelum,
        row.nominalBelum,
        row.jumlahSudah,
        row.nominalSudah,
        row.jumlahTunai,
        row.nominalTunai,
        row.jumlahTransfer,
        row.nominalTransfer,
        row.nominalBelum + row.nominalSudah,
      ]
        .map(csvCell)
        .join(";")
    ),
  ];
  const totals = params.rows.reduce(
    (acc, row) => ({
      jumlahBelum: acc.jumlahBelum + row.jumlahBelum,
      nominalBelum: acc.nominalBelum + row.nominalBelum,
      jumlahSudah: acc.jumlahSudah + row.jumlahSudah,
      nominalSudah: acc.nominalSudah + row.nominalSudah,
      jumlahTunai: acc.jumlahTunai + row.jumlahTunai,
      nominalTunai: acc.nominalTunai + row.nominalTunai,
      jumlahTransfer: acc.jumlahTransfer + row.jumlahTransfer,
      nominalTransfer: acc.nominalTransfer + row.nominalTransfer,
    }),
    {
      jumlahBelum: 0,
      nominalBelum: 0,
      jumlahSudah: 0,
      nominalSudah: 0,
      jumlahTunai: 0,
      nominalTunai: 0,
      jumlahTransfer: 0,
      nominalTransfer: 0,
    }
  );
  lines.push(
    [
      "TOTAL",
      "",
      totals.jumlahBelum,
      totals.nominalBelum,
      totals.jumlahSudah,
      totals.nominalSudah,
      totals.jumlahTunai,
      totals.nominalTunai,
      totals.jumlahTransfer,
      totals.nominalTransfer,
      totals.nominalBelum + totals.nominalSudah,
    ]
      .map(csvCell)
      .join(";")
  );

  const slug = params.periodLabel.toLowerCase().replace(/\s+/g, "-");
  const nama = params.penagihNama.toLowerCase().replace(/\s+/g, "-");
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rekap-petugas-${nama}-${slug}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CetakRekapMetode(props: {
  bulan: string;
  penagihNama: string;
  rows: RekapMetodeBaris[];
}) {
  const periodLabel = formatBillingPeriodLabel(props.bulan);
  const totals = props.rows.reduce(
    (acc, row) => ({
      jumlahBelum: acc.jumlahBelum + row.jumlahBelum,
      nominalBelum: acc.nominalBelum + row.nominalBelum,
      jumlahSudah: acc.jumlahSudah + row.jumlahSudah,
      nominalSudah: acc.nominalSudah + row.nominalSudah,
      jumlahTunai: acc.jumlahTunai + row.jumlahTunai,
      nominalTunai: acc.nominalTunai + row.nominalTunai,
      jumlahTransfer: acc.jumlahTransfer + row.jumlahTransfer,
      nominalTransfer: acc.nominalTransfer + row.nominalTransfer,
    }),
    {
      jumlahBelum: 0,
      nominalBelum: 0,
      jumlahSudah: 0,
      nominalSudah: 0,
      jumlahTunai: 0,
      nominalTunai: 0,
      jumlahTransfer: 0,
      nominalTransfer: 0,
    }
  );
  const totalDitagih = totals.nominalBelum + totals.nominalSudah;

  return (
    <>
      <style jsx global>{`
        .rekap-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .rekap-th,
        .rekap-td {
          border: 1px solid #334155;
          padding: 4px 5px;
          font-size: 11px;
          vertical-align: middle;
        }
        .rekap-th {
          background: #0f172a;
          color: #fff;
          font-weight: 600;
          text-align: center;
        }
        .rekap-td-num {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .rekap-title {
          margin: 0;
          text-align: center;
          font-size: 16px;
          font-weight: 700;
        }
        .rekap-sub {
          margin: 4px 0 12px;
          text-align: center;
          font-size: 12px;
        }
        .rekap-sum {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-bottom: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .rekap-total td {
          font-weight: 700;
          background: #f1f5f9;
        }
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          html,
          body {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .rekap-th {
            background: #0f172a !important;
            color: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .rekap-th,
          .rekap-td {
            font-size: 8pt;
            padding: 1.2mm 1.4mm;
          }
        }
      `}</style>
      <div className="mx-auto max-w-[1100px] px-4 py-6 text-slate-900">
        <div className="no-print mb-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
            disabled={props.rows.length === 0}
            onClick={() =>
              downloadExcel({
                periodLabel,
                penagihNama: props.penagihNama,
                rows: props.rows,
              })
            }
          >
            <FileSpreadsheet className="size-4" />
            Excel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm"
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            Cetak
          </button>
        </div>
        <h1 className="rekap-title">{props.penagihNama}</h1>
        <p className="rekap-sub">Rincian tagihan {periodLabel}</p>
        <div className="rekap-sum">
          <span>Total ditagih {formatIdr(totalDitagih)}</span>
          <span>Belum bayar {formatIdr(totals.nominalBelum)}</span>
          <span>Sudah bayar {formatIdr(totals.nominalSudah)}</span>
        </div>
        {props.rows.length === 0 ? (
          <p className="text-center text-sm">
            Belum ada tagihan untuk petugas ini pada {periodLabel}.
          </p>
        ) : (
          <table className="rekap-table">
            <thead>
              <tr>
                <th className="rekap-th">Paket</th>
                <th className="rekap-th">Harga paket</th>
                <th className="rekap-th">Jml belum</th>
                <th className="rekap-th">Belum bayar</th>
                <th className="rekap-th">Jml sudah</th>
                <th className="rekap-th">Sudah bayar</th>
                <th className="rekap-th">Jml tunai</th>
                <th className="rekap-th">Tunai</th>
                <th className="rekap-th">Jml transfer</th>
                <th className="rekap-th">Transfer</th>
                <th className="rekap-th">Total ditagih</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => (
                <tr key={row.paketId}>
                  <td className="rekap-td">{row.nama}</td>
                  <td className="rekap-td rekap-td-num">{formatIdr(row.harga)}</td>
                  <td className="rekap-td rekap-td-num">{row.jumlahBelum}</td>
                  <td className="rekap-td rekap-td-num">{formatIdr(row.nominalBelum)}</td>
                  <td className="rekap-td rekap-td-num">{row.jumlahSudah}</td>
                  <td className="rekap-td rekap-td-num">{formatIdr(row.nominalSudah)}</td>
                  <td className="rekap-td rekap-td-num">{row.jumlahTunai}</td>
                  <td className="rekap-td rekap-td-num">{formatIdr(row.nominalTunai)}</td>
                  <td className="rekap-td rekap-td-num">{row.jumlahTransfer}</td>
                  <td className="rekap-td rekap-td-num">{formatIdr(row.nominalTransfer)}</td>
                  <td className="rekap-td rekap-td-num">
                    {formatIdr(row.nominalBelum + row.nominalSudah)}
                  </td>
                </tr>
              ))}
              <tr className="rekap-total">
                <td className="rekap-td" colSpan={2}>
                  Total
                </td>
                <td className="rekap-td rekap-td-num">{totals.jumlahBelum}</td>
                <td className="rekap-td rekap-td-num">{formatIdr(totals.nominalBelum)}</td>
                <td className="rekap-td rekap-td-num">{totals.jumlahSudah}</td>
                <td className="rekap-td rekap-td-num">{formatIdr(totals.nominalSudah)}</td>
                <td className="rekap-td rekap-td-num">{totals.jumlahTunai}</td>
                <td className="rekap-td rekap-td-num">{formatIdr(totals.nominalTunai)}</td>
                <td className="rekap-td rekap-td-num">{totals.jumlahTransfer}</td>
                <td className="rekap-td rekap-td-num">{formatIdr(totals.nominalTransfer)}</td>
                <td className="rekap-td rekap-td-num">{formatIdr(totalDitagih)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
