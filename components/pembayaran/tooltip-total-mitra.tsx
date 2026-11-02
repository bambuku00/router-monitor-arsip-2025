"use client";

import Tooltip from "@mui/material/Tooltip";
import { Rekapan } from "./page-data-mitra";
import { useMemo } from "react";

export default function TooltipTotalMitra({
  rekapan,
  partialTotals = false,
}: {
  rekapan: Rekapan[];
  /** true jika hanya sebagian mitra (paginasi); ringkasan = halaman ini saja */
  partialTotals?: boolean;
}) {
  const data = useMemo(() => {
    if (rekapan.length === 0) return;
    const kantor = rekapan.reduce(
      (acc, val) => acc + val.pembayaran.tagihanKantor,
      0
    );
    const terbayar = rekapan.reduce(
      (acc, val) => acc + val.pembayaran.bayar,
      0
    );
    return {
      kantor: kantor,
      terbayar: terbayar,
      belum: kantor - terbayar,
    };
  }, [rekapan]);

  return (
    <Tooltip
      /* open */
      placement="top"
      enterTouchDelay={100}
      className="cursor-pointer"
      slotProps={{
        tooltip: {
          className: "grid bg-amber-500/80 text-sm p-4",
        },
        arrow: {
          className: "text-amber-500/80",
        },
      }}
      title={
        <>
          {partialTotals ? (
            <p className="text-xs font-normal opacity-90 mb-2 border-b border-amber-200/50 pb-2">
              Ringkasan dari mitra di halaman ini saja (bukan seluruh daftar).
            </p>
          ) : null}
          <div>
            <p>Kantor Pusat</p>
            <p className="font-semibold">
              {data?.kantor.toLocaleString("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
          <div>
            <p>Terbayar</p>
            <p className="font-semibold">
              {data?.terbayar.toLocaleString("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
          <div>
            <p>Belum</p>
            <p className="font-semibold">
              {data?.belum.toLocaleString("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        </>
      }
      arrow
    >
      <div className="fixed grid justify-center text-center right-8 bottom-2 p-2 bg-amber-500/90 text-slate-50 font-semibold text-sm rounded-lg border">
        <p>Total:</p>
        <p>
          {data?.kantor.toLocaleString("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
          })}
        </p>
      </div>
    </Tooltip>
  );
}
