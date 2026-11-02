"use client";

import { formatBillingPeriodLabel } from "@/lib/billing-due-date";
import { FileSpreadsheet, Printer } from "lucide-react";

type Row = {
  id: number;
  total: number;
  nama: string;
  alamat: string;
  nomor?: string;
};

type Group = {
  penagihId: number | null;
  penagihNama: string;
  aktif: boolean;
  rows: Row[];
};

function formatIdr(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadBerkasExcel(params: {
  periodLabel: string;
  groups: Group[];
}) {
  const lines: string[] = [];
  for (const group of params.groups) {
    const petugas = group.penagihNama
      ? `${params.periodLabel} · ${group.penagihNama}${group.aktif ? "" : " (nonaktif)"}`
      : params.periodLabel;
    lines.push(csvCell(`Periode ${petugas}`));
    lines.push(
      [
        "NO",
        "PELANGGAN",
        "ALAMAT",
        "NO. TLP",
        "TAGIHAN",
        "BAYAR CASH",
        "BAYAR TF",
        "ISOLIRAN CASH",
        "ISOLIRAN TF",
      ]
        .map(csvCell)
        .join(";")
    );
    for (const [index, row] of group.rows.entries()) {
      lines.push(
        [
          index + 1,
          row.nama,
          row.alamat,
          row.nomor ?? "",
          row.total,
          "",
          "",
          "",
          "",
        ]
          .map(csvCell)
          .join(";")
      );
    }
    lines.push("");
  }

  const slug = params.periodLabel.toLowerCase().replace(/\s+/g, "-");
  const petugasSlug =
    params.groups.length === 1 && params.groups[0]?.penagihNama
      ? `-${params.groups[0].penagihNama.toLowerCase().replace(/\s+/g, "-")}`
      : "";
  const filename = `berkas-penagihan-${slug}${petugasSlug}.csv`;
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CetakBerkasPenagihan(props: {
  period: string;
  groups: Group[];
}) {
  const periodLabel = formatBillingPeriodLabel(props.period);

  return (
    <>
      <style jsx global>{`
        .berkas-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: fixed;
          border: 1px solid #64748b;
        }

        .berkas-th,
        .berkas-td {
          box-sizing: border-box;
          border-right: 1px solid #64748b;
          border-bottom: 1px solid #64748b;
          padding: 4px 5px;
          vertical-align: top;
          text-align: left;
          line-height: 1.25;
          background-clip: padding-box;
        }

        .berkas-th:last-child,
        .berkas-td:last-child {
          border-right: none;
        }

        tbody tr:last-child .berkas-td {
          border-bottom: none;
        }

        .berkas-th {
          background: #dc2626;
          color: #fff;
          font-weight: 600;
          font-size: 11px;
          text-align: center;
          vertical-align: middle;
        }

        .berkas-td {
          font-size: 11px;
        }

        .berkas-th-no,
        .berkas-td-no {
          text-align: center;
        }

        .berkas-th-check,
        .berkas-td-check {
          padding: 4px 2px;
          text-align: center;
          height: 1.9rem;
        }

        .berkas-td-text {
          overflow: hidden;
          word-break: break-word;
        }

        .berkas-th-tagihan,
        .berkas-td-tagihan {
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .berkas-title {
          margin: 0 0 12px;
          font-size: 14px;
          font-weight: 600;
          text-align: center;
          color: #000;
        }

        .berkas-footer {
          margin-top: 8px;
          font-size: 11px;
          font-weight: 600;
        }

        @media print {
          @page {
            size: A4 portrait;
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

          .berkas-root {
            padding: 8mm 10mm !important;
            max-width: none !important;
            width: 100% !important;
          }

          .berkas-sheet {
            break-after: page;
            page-break-after: always;
          }

          .berkas-sheet:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          .berkas-table thead {
            display: table-header-group;
          }

          .berkas-table {
            border: 0.3mm solid #333 !important;
          }

          .berkas-th,
          .berkas-td {
            padding: 1mm 1.2mm !important;
            border-right: 0.3mm solid #333 !important;
            border-bottom: 0.3mm solid #333 !important;
            font-size: 8pt;
          }

          .berkas-th:last-child,
          .berkas-td:last-child {
            border-right: none !important;
          }

          tbody tr:last-child .berkas-td {
            border-bottom: none !important;
          }

          .berkas-th {
            background: #dc2626 !important;
            color: #fff !important;
            font-size: 7.5pt;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .berkas-title {
            font-size: 11pt;
          }
        }
      `}</style>

      <div className="berkas-root max-w-[900px] mx-auto px-4 py-6 md:py-8">
        <div className="no-print flex flex-wrap justify-end gap-2 mb-6">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
            disabled={props.groups.length === 0}
            onClick={() =>
              downloadBerkasExcel({
                periodLabel,
                groups: props.groups,
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

        {props.groups.length === 0 ? (
          <p className="text-sm">
            Tidak ada pelanggan ditugaskan untuk periode {periodLabel}.
          </p>
        ) : (
          props.groups.map((group) => (
            <section
              key={group.penagihId ?? "none"}
              className="berkas-sheet mb-8"
            >
              <p className="berkas-title">
                Periode {periodLabel}
                {group.penagihNama ? ` · ${group.penagihNama}` : ""}
                {group.aktif ? "" : " (nonaktif)"}
              </p>
              <table className="berkas-table">
                <colgroup>
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="berkas-th berkas-th-no" rowSpan={2}>
                      NO
                    </th>
                    <th className="berkas-th" rowSpan={2}>
                      PELANGGAN
                    </th>
                    <th className="berkas-th" rowSpan={2}>
                      ALAMAT
                    </th>
                    <th className="berkas-th" rowSpan={2}>
                      NO. TLP
                    </th>
                    <th className="berkas-th berkas-th-tagihan" rowSpan={2}>
                      TAGIHAN
                    </th>
                    <th className="berkas-th" colSpan={2}>
                      BAYAR
                    </th>
                    <th className="berkas-th" colSpan={2}>
                      ISOLIRAN
                    </th>
                  </tr>
                  <tr>
                    <th className="berkas-th berkas-th-check">CASH</th>
                    <th className="berkas-th berkas-th-check">TF</th>
                    <th className="berkas-th berkas-th-check">CASH</th>
                    <th className="berkas-th berkas-th-check">TF</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, index) => (
                    <tr key={`${group.penagihId ?? "none"}-${row.id}-${index}`}>
                      <td className="berkas-td berkas-td-no">{index + 1}</td>
                      <td className="berkas-td berkas-td-text">{row.nama}</td>
                      <td className="berkas-td berkas-td-text">{row.alamat}</td>
                      <td className="berkas-td">{row.nomor ?? ""}</td>
                      <td className="berkas-td berkas-td-tagihan">
                        {formatIdr(row.total)}
                      </td>
                      <td className="berkas-td berkas-td-check" />
                      <td className="berkas-td berkas-td-check" />
                      <td className="berkas-td berkas-td-check" />
                      <td className="berkas-td berkas-td-check" />
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="berkas-footer">
                {group.rows.length} pelanggan ·{" "}
                {formatIdr(group.rows.reduce((sum, row) => sum + row.total, 0))}
              </p>
            </section>
          ))
        )}
      </div>
    </>
  );
}
