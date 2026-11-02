"use client";

import type { PembayaranKuitansiData } from "@/lib/pembayaran-kuitansi";
import { terbilangRupiah } from "@/lib/terbilang";
import { useEffect } from "react";

function formatIdr(n: number) {
  return n.toLocaleString("id-ID");
}

type Props = {
  data: PembayaranKuitansiData;
  autoPrint?: boolean;
};

export default function CetakKuitansi({ data, autoPrint = true }: Props) {
  useEffect(() => {
    if (!autoPrint) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [autoPrint]);

  const { nominal, isPaid } = data;
  const terbilang = terbilangRupiah(nominal.total);

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            margin: 12mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
        .kuitansi-table th,
        .kuitansi-table td {
          border: 1px solid #ccc;
          padding: 8px;
        }
        .kuitansi-table th {
          background: #999595;
          color: #fff;
        }
      `}</style>

      <div className="max-w-[210mm] mx-auto p-4 md:p-8 text-slate-900 bg-white text-sm font-sans">
        {/* Header mitra */}
        <div className="flex justify-between items-start gap-4 mb-6">
          <div className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Logo"
              className="h-14 w-auto object-contain"
            />
          </div>
          <div className="text-right text-xs leading-relaxed max-w-[55%]">
            <h3 className="text-base font-bold">{data.mitra.nama}</h3>
            {data.mitra.alamat ? <p>{data.mitra.alamat}</p> : null}
            {data.mitra.nomor ? <p>Telp: {data.mitra.nomor}</p> : null}
          </div>
        </div>

        {isPaid ? (
          <>
            <h2 className="text-lg font-bold underline mb-4">
              BUKTI PEMBAYARAN
            </h2>
            <div
              className="rounded p-3 mb-4 text-sm leading-relaxed"
              style={{ backgroundColor: "#7FFF00" }}
            >
              <p>
                Nomor Invoice&emsp;&emsp;: <b>{data.invoiceNo}</b>
              </p>
              <p>Tanggal&emsp;&emsp;&emsp;&emsp;&emsp;: {data.tanggalInvoice}</p>
              <p>Kode Periode&emsp;&emsp;&emsp;: {data.periodeCode}</p>
              <p>
                Status Bayar&emsp;&emsp;&emsp;: {data.statusLabel}
                {data.tanggalBayarLabel
                  ? ` , Tanggal Bayar: ${data.tanggalBayarLabel}`
                  : ""}
              </p>
            </div>
            <div className="mb-4 leading-relaxed">
              <p>Telah terima dari :</p>
              <p className="font-bold">{data.pelanggan.nama}</p>
              <p>{data.pelanggan.alamat}</p>
              <p>{data.pelanggan.nomor}</p>
            </div>
            <p className="mb-4">
              Terima kasih telah melakukan pembayaran.
              <br />
              Berikut kami sampaikan bukti pembayaran invoice dengan rincian
              sebagai berikut :
            </p>
          </>
        ) : (
          <>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-sky-700">INVOICE</h2>
              <p className="text-red-600 font-bold text-lg">BELUM LUNAS</p>
            </div>
            <div className="mb-4 text-sm border border-slate-300 rounded p-3 inline-block min-w-[240px]">
              <p className="font-bold text-center text-lg mb-2">{data.invoiceNo}</p>
              <p>Tanggal invoice: {data.tanggalInvoice}</p>
              <p>Jatuh tempo: {data.jatuhTempoLabel}</p>
              <p>Tanggal cetak: {data.tanggalCetak}</p>
            </div>
            <div className="mb-4 leading-relaxed">
              <p>Kepada Yth,</p>
              <p className="font-bold">{data.pelanggan.nama}</p>
              <p>{data.pelanggan.alamat}</p>
              <p>{data.pelanggan.nomor}</p>
              <p>NO. LAYANAN {data.pelanggan.noLayanan}</p>
            </div>
          </>
        )}

        <table className="kuitansi-table w-full border-collapse mb-4 text-sm">
          <thead>
            <tr>
              {isPaid ? (
                <>
                  <th style={{ width: "5%" }}>No</th>
                  <th style={{ width: "20%" }}>Layanan</th>
                  <th style={{ width: "30%" }}>Deskripsi</th>
                  <th style={{ width: "15%" }}>Nominal</th>
                </>
              ) : (
                <>
                  <th>RINGKASAN TAGIHAN</th>
                  <th style={{ width: "150px" }}>JUMLAH</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              {isPaid ? (
                <>
                  <td className="text-center">1</td>
                  <td>{data.paket.nama}</td>
                  <td>{data.paket.deskripsi}</td>
                  <td>Rp. {formatIdr(nominal.dpp)}</td>
                </>
              ) : (
                <>
                  <td>
                    PAKET {formatIdr(nominal.dpp)} ({data.periodeLabel})
                  </td>
                  <td className="text-right">{formatIdr(nominal.dpp)}</td>
                </>
              )}
            </tr>
            <tr>
              {isPaid ? (
                <>
                  <td colSpan={3} className="text-right">
                    Sub Total
                  </td>
                  <td>Rp. {formatIdr(nominal.dpp)}</td>
                </>
              ) : (
                <>
                  <td className="text-right">SUB TOTAL</td>
                  <td className="text-right">{formatIdr(nominal.dpp)}</td>
                </>
              )}
            </tr>
            {nominal.ppn > 0 ? (
              <tr>
                {isPaid ? (
                  <>
                    <td colSpan={3} className="text-right">
                      PPN
                    </td>
                    <td>Rp. {formatIdr(nominal.ppn)}</td>
                  </>
                ) : (
                  <>
                    <td className="text-right">PPN</td>
                    <td className="text-right">{formatIdr(nominal.ppn)}</td>
                  </>
                )}
              </tr>
            ) : null}
            {nominal.potongan > 0 ? (
              <tr>
                {isPaid ? (
                  <>
                    <td colSpan={3} className="text-right">
                      Potongan Harga
                    </td>
                    <td>Rp. {formatIdr(nominal.potongan)}</td>
                  </>
                ) : (
                  <>
                    <td className="text-right">DISKON</td>
                    <td className="text-right">{formatIdr(nominal.potongan)}</td>
                  </>
                )}
              </tr>
            ) : null}
            <tr>
              {isPaid ? (
                <>
                  <td colSpan={3} className="text-right font-bold">
                    Grand Total
                  </td>
                  <td className="font-bold">Rp. {formatIdr(nominal.total)}</td>
                </>
              ) : (
                <>
                  <td className="text-right font-bold">TOTAL TAGIHAN</td>
                  <td className="text-right font-bold">
                    {formatIdr(nominal.total)}
                  </td>
                </>
              )}
            </tr>
          </tbody>
        </table>

        <p className="italic mb-6">
          Terbilang : {terbilang} Rupiah
        </p>

        {isPaid ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <p className="font-bold">
                Pembayaran melalui Transfer Bank / Cash * :
              </p>
              <p className="text-xs italic">*coret yang tidak diperlukan</p>
              {data.metodeLabel ? (
                <p className="mt-2">
                  <b>{data.metodeLabel}</b>
                  {data.channelLabel ? ` — ${data.channelLabel}` : ""}
                </p>
              ) : null}
              <p className="mt-2">
                <b>Penerima:</b> {data.penerima}
              </p>
            </div>
            <div className="md:text-right">
              <p className="font-bold">Terima kasih telah menggunakan layanan kami</p>
              <p>Best Regards</p>
              <p className="mt-16 font-medium">{data.mitra.nama}</p>
            </div>
          </div>
        ) : (
          <div className="mb-8 space-y-2">
            <p className="font-bold">Pembayaran dapat melalui transfer via bank:</p>
            {data.channelLabel ? <p>{data.channelLabel}</p> : null}
            <ol className="list-decimal list-inside text-sm mt-3 space-y-1">
              <li>
                Transfer sejumlah yang tertera di atas sampai digit terakhir.
              </li>
              <li>
                Bayarlah sebelum tanggal jatuh tempo agar terhindar dari isolir
                oleh sistem.
              </li>
            </ol>
          </div>
        )}

        <div className="no-print flex gap-2 justify-end pt-4 border-t">
          <button
            type="button"
            className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700"
            onClick={() => window.print()}
          >
            Cetak
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            onClick={() => window.close()}
          >
            Tutup
          </button>
        </div>
      </div>
    </>
  );
}
