"use client";

import {
  formatTglIsolirCetak,
  type PembayaranCetakData,
  type PembayaranCetakRow,
} from "@/lib/pembayaran-cetak";
import { useEffect, useMemo } from "react";
import { Printer } from "lucide-react";

function formatIdr(value: number) {
  return value.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

function formatMetodeTerbayar(row: PembayaranCetakRow) {
  if (row.metode === "Cash") return "Cash";
  if (row.metode === "Transfer") return "Transfer";
  return "—";
}

/** Lebar kolom tetap (%) — jumlah harus 100 agar garis vertikal lurus. */
const COL_WIDTHS = {
  base: ["5%", "21%", "12%", "13%", "11%", "16%", "22%"],
  baseBelum: ["5%", "18%", "11%", "12%", "10%", "14%", "12%", "18%"],
  withMetode: ["5%", "19%", "10%", "12%", "10%", "14%", "16%", "14%"],
} as const;

function ColGroup({
  showMetode,
  showBelumBayarCol,
  showPppUsername,
}: {
  showMetode?: boolean;
  showBelumBayarCol?: boolean;
  showPppUsername: boolean;
}) {
  const widths = showMetode
    ? COL_WIDTHS.withMetode
    : showBelumBayarCol
      ? COL_WIDTHS.baseBelum
      : COL_WIDTHS.base;
  const used = showPppUsername ? widths : widths.filter((_, index) => index !== 3);
  return (
    <colgroup>
      {used.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
}

function CetakTable({
  title,
  accentClass,
  rows,
  showMetode,
  showBelumBayarCol,
  showPppUsername,
  totalNominal,
}: {
  title: string;
  accentClass: string;
  rows: PembayaranCetakRow[];
  showMetode?: boolean;
  showBelumBayarCol?: boolean;
  showPppUsername: boolean;
  totalNominal: number;
}) {
  return (
    <section className="cetak-table-section mb-6 print:mb-3">
      <h2
        className={`cetak-section-title text-base font-semibold mb-2 pb-1.5 border-b-2 ${accentClass}`}
      >
        {title}{" "}
        <span className="text-slate-600 font-normal">
          ({rows.length.toLocaleString("id-ID")} pelanggan)
        </span>
      </h2>
      {rows.length === 0 ? (
        <p className="text-slate-500 text-sm py-2">Tidak ada data.</p>
      ) : (
        <>
          <table className="cetak-table">
            <ColGroup
              showMetode={showMetode}
              showBelumBayarCol={showBelumBayarCol}
              showPppUsername={showPppUsername}
            />
            <thead>
              <tr>
                <th className="cetak-th cetak-th-no">No</th>
                <th className="cetak-th">Nama</th>
                <th className="cetak-th">Router</th>
                {showPppUsername ? <th className="cetak-th">PPP</th> : null}
                <th className="cetak-th">Paket</th>
                <th className="cetak-th cetak-th-tagihan">Tagihan</th>
                <th className="cetak-th">Jatuh Tempo</th>
                {showBelumBayarCol ? (
                  <th className="cetak-th cetak-th-no">Belum Bayar</th>
                ) : null}
                {showMetode ? (
                  <th className="cetak-th cetak-th-no">Metode</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id}>
                  <td className="cetak-td cetak-td-no">{i + 1}</td>
                  <td className="cetak-td">
                    <div className="cetak-cell-nama">{row.pelanggan.nama}</div>
                    {row.pelanggan.nomor ? (
                      <div className="cetak-cell-sub">{row.pelanggan.nomor}</div>
                    ) : null}
                  </td>
                  <td className="cetak-td cetak-td-text">{row.pelanggan.router.nama}</td>
                  {showPppUsername ? (
                    <td className="cetak-td cetak-td-text">
                      {row.pelanggan.ppp_secret?.name || "—"}
                    </td>
                  ) : null}
                  <td className="cetak-td cetak-td-text">{row.pelanggan.paket.nama}</td>
                  <td className="cetak-td cetak-td-tagihan">
                    {formatIdr(Number(row.total))}
                  </td>
                  <td className="cetak-td cetak-td-date">
                    {formatTglIsolirCetak(row.pelanggan.tgl_isolir)}
                  </td>
                  {showBelumBayarCol ? (
                    <td className="cetak-td cetak-td-no">Belum Bayar</td>
                  ) : null}
                  {showMetode ? (
                    <td className="cetak-td cetak-td-no">
                      {formatMetodeTerbayar(row)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cetak-total-bar">
            <span className="cetak-total-label">Total</span>
            <span className="cetak-total-value">{formatIdr(totalNominal)}</span>
          </div>
        </>
      )}
    </section>
  );
}

function formatFilterSubtitle(data: PembayaranCetakData) {
  const parts: string[] = [];
  if (data.bayarFilter === "belum") parts.push("Belum bayar");
  else if (data.bayarFilter === "terbayar") parts.push("Sudah bayar");
  if (data.isolirFilter === "isolir") parts.push("PPP isolir");
  else if (data.isolirFilter === "aktif") parts.push("PPP aktif");
  if (data.staffLabel) parts.push(`Staff: ${data.staffLabel}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default function CetakLaporan({
  data,
  showPppUsername = true,
}: {
  data: PembayaranCetakData;
  showPppUsername?: boolean;
}) {
  const showBelum = data.bayarFilter !== "terbayar";
  const showTerbayar = data.bayarFilter !== "belum";
  const totalRows =
    (showBelum ? data.belum.length : 0) +
    (showTerbayar ? data.terbayar.length : 0);
  const filterSubtitle = formatFilterSubtitle(data);

  const densityHint = useMemo(() => {
    if (totalRows >= 400) return "Daftar panjang — pilih orientasi Landscape.";
    if (totalRows >= 150) return "Disarankan orientasi Landscape saat cetak.";
    return null;
  }, [totalRows]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "\u00A0";

    const t = window.setTimeout(() => window.print(), 400);
    const restoreTitle = () => {
      document.title = prevTitle;
    };
    window.addEventListener("afterprint", restoreTitle);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", restoreTitle);
      document.title = prevTitle;
    };
  }, []);

  return (
    <>
      <style jsx global>{`
        .cetak-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: fixed;
          border: 1px solid #64748b;
        }

        .cetak-th,
        .cetak-td {
          box-sizing: border-box;
          border-right: 1px solid #64748b;
          border-bottom: 1px solid #64748b;
          padding: 4px 5px;
          vertical-align: top;
          text-align: left;
          line-height: 1.25;
          background-clip: padding-box;
        }

        .cetak-th:last-child,
        .cetak-td:last-child {
          border-right: none;
        }

        tbody tr:last-child .cetak-td {
          border-bottom: none;
        }

        .cetak-td-text {
          overflow: hidden;
          text-overflow: ellipsis;
          word-break: break-word;
        }

        .cetak-th {
          background: #e2e8f0;
          font-weight: 600;
          font-size: 11px;
        }

        .cetak-td {
          font-size: 11px;
        }

        .cetak-th-no,
        .cetak-td-no {
          text-align: center;
        }

        .cetak-th-tagihan,
        .cetak-td-tagihan {
          text-align: left;
          font-variant-numeric: tabular-nums;
          overflow: visible;
          word-break: break-word;
        }

        .cetak-th-num,
        .cetak-td-num {
          text-align: right;
          font-variant-numeric: tabular-nums;
          overflow: visible;
          word-break: break-word;
        }

        .cetak-td-date {
          font-size: 10px;
          overflow: visible;
          word-break: break-word;
        }

        .cetak-cell-nama {
          font-weight: 500;
          word-break: break-word;
        }

        .cetak-cell-sub {
          font-size: 9px;
          color: #64748b;
          margin-top: 1px;
          word-break: break-word;
        }

        tbody tr:nth-child(even) .cetak-td {
          background: #f8fafc;
        }

        .cetak-total-bar {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 8px;
          margin-top: -1px;
          padding: 5px 6px;
          border: 1px solid #64748b;
          border-top: 2px solid #64748b;
          background: #e2e8f0;
          font-size: 11px;
          font-weight: 600;
        }

        .cetak-total-label {
          text-align: right;
        }

        .cetak-total-value {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          min-width: 7rem;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }

          html,
          body {
            background: #fff !important;
            color: #000 !important;
            min-height: 0 !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body > main {
            min-height: 0 !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .no-print,
          a[href] {
            display: none !important;
          }

          .cetak-root {
            padding: 8mm 10mm !important;
            max-width: none !important;
            width: 100% !important;
          }

          .cetak-table-section {
            break-inside: auto;
            page-break-inside: auto;
          }

          .cetak-section-title {
            font-size: 11pt;
          }

          .cetak-table thead {
            display: table-header-group;
          }

          .cetak-table {
            border: 0.3mm solid #333 !important;
          }

          .cetak-th,
          .cetak-td {
            padding: 1mm 1.2mm !important;
            border-right: 0.3mm solid #333 !important;
            border-bottom: 0.3mm solid #333 !important;
            font-size: 7.5pt;
          }

          .cetak-th:last-child,
          .cetak-td:last-child {
            border-right: none !important;
          }

          tbody tr:last-child .cetak-td {
            border-bottom: none !important;
          }

          .cetak-td-tagihan,
          .cetak-td-date {
            overflow: visible !important;
          }

          .cetak-th {
            background: #ddd !important;
            font-size: 7pt;
          }

          .cetak-td-date {
            font-size: 7pt;
          }

          .cetak-cell-sub {
            font-size: 6pt;
          }

          tbody tr:nth-child(even) .cetak-td {
            background: #f5f5f5 !important;
          }

          .cetak-total-bar {
            font-size: 8pt;
            padding: 1.2mm 1.5mm;
            border: 0.25mm solid #666 !important;
            border-top: 0.5mm solid #333 !important;
            background: #ddd !important;
          }
        }
      `}</style>

      <div className="cetak-root max-w-[1200px] mx-auto px-4 py-6 md:py-8 print:px-0 print:py-0">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="text-sm text-slate-600">
            <p>
              Total {totalRows.toLocaleString("id-ID")} baris
              {showBelum && showTerbayar ? (
                <>
                  {" "}
                  ({data.belum.length.toLocaleString("id-ID")} belum,{" "}
                  {data.terbayar.length.toLocaleString("id-ID")} terbayar)
                </>
              ) : null}
            </p>
            {densityHint ? (
              <p className="text-amber-700 mt-1">{densityHint}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-900 hover:bg-sky-800 text-white px-4 py-2 text-sm font-medium"
            >
              <Printer className="size-4" />
              Cetak
            </button>
            <button
              type="button"
              onClick={() => window.close()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
            >
              Tutup
            </button>
          </div>
        </div>

        <div className="cetak-doc-header mb-6 print:mb-3 text-center border-b border-slate-200 pb-4 print:pb-2">
          <h1 className="text-xl font-bold text-slate-900 print:text-base">
            Laporan Pembayaran Pelanggan
          </h1>
          <p className="text-base text-slate-700 mt-1 print:text-sm">
            {data.mitraNama}
          </p>
          <p className="text-slate-600 print:text-xs">
            Periode: {data.bulanLabel}
          </p>
          {filterSubtitle ? (
            <p className="text-slate-600 print:text-xs mt-0.5">
              Filter: {filterSubtitle}
            </p>
          ) : null}
          <p className="text-xs text-slate-400 mt-1 no-print">
            Dicetak:{" "}
            {new Intl.DateTimeFormat("id-ID", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(new Date())}
          </p>
        </div>

        <p className="no-print text-xs text-slate-500 mb-4">
          Tip: di dialog cetak browser, matikan opsi &quot;Headers and footers&quot;
          agar URL dan nomor halaman tidak ikut tercetak.
        </p>

        <div
          className={`grid gap-3 mb-6 print:mb-3 print:gap-2 text-sm ${
            showBelum && showTerbayar
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1"
          }`}
        >
          {showBelum ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 print:py-1 print:rounded-none">
              <p className="text-red-800 font-medium text-xs">Belum Bayar</p>
              <p className="font-bold text-red-900 tabular-nums print:text-xs">
                {data.belum.length.toLocaleString("id-ID")} pelanggan ·{" "}
                {formatIdr(data.totalBelum)}
              </p>
            </div>
          ) : null}
          {showTerbayar ? (
            <div className="rounded border border-green-200 bg-green-50 px-3 py-2 print:py-1 print:rounded-none">
              <p className="text-green-800 font-medium text-xs">Sudah Bayar</p>
              <p className="font-bold text-green-900 tabular-nums print:text-xs">
                {data.terbayar.length.toLocaleString("id-ID")} pelanggan ·{" "}
                {formatIdr(data.totalTerbayar)}
              </p>
            </div>
          ) : null}
        </div>

        {totalRows === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">
            Tidak ada data untuk filter yang dipilih.
          </p>
        ) : null}

        {showBelum && data.belum.length > 0 ? (
          <CetakTable
            title="Belum Bayar"
            accentClass="border-red-500 text-red-700"
            rows={data.belum}
            showBelumBayarCol
            showPppUsername={showPppUsername}
            totalNominal={data.totalBelum}
          />
        ) : null}
        {showTerbayar && data.terbayar.length > 0 ? (
          <CetakTable
            title="Sudah Bayar"
            accentClass="border-green-500 text-green-700"
            rows={data.terbayar}
            showMetode
            showPppUsername={showPppUsername}
            totalNominal={data.totalTerbayar}
          />
        ) : null}
      </div>
    </>
  );
}
