"use client";

import Tooltip from "@mui/material/Tooltip";
import { GetPPP } from "@/lib/server-actions/router/ppp/actions";

export default function TooltipTotal({
  totalTagih,
}: {
  totalTagih: GetPPP["totalTagih"] | undefined;
}) {
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
          <div>
            <p>Semua</p>
            <p className="font-semibold">
              {totalTagih?.harga.toLocaleString("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
          <div>
            <p>PPN</p>
            <p className="font-semibold">
              {totalTagih?.ppn.toLocaleString("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
          <div>
            <p>Total</p>
            <p className="font-semibold">
              {totalTagih?.total.toLocaleString("id-ID", {
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
          {totalTagih?.total.toLocaleString("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
          })}
        </p>
      </div>
    </Tooltip>
  );
}
