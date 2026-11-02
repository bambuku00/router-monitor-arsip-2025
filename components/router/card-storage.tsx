"use client";

import { formatBytes } from "@/lib/utils";
import { Gauge, gaugeClasses } from "@mui/x-charts";

export default function CardStorage({
  free,
  total,
  used,
}: {
  free: number | undefined;
  total: number | undefined;
  used: number | undefined;
}) {
  return (
    <div className="rounded-md shadow-lg flex flex-col overflow-hidden *:px-3 *:py-2">
      <div className="bg-slate-700 text-white">
        <p>Storage</p>
      </div>
      <div className="bg-white dark:bg-theme-card text-slate-700 dark:text-theme-fg flex flex-col items-stretch gap-2">
        <Gauge
          width={180}
          height={180}
          value={used}
          valueMax={total}
          startAngle={-90}
          endAngle={90}
          text={({ value }) => formatBytes(value || NaN)}
          sx={{
            margin: "0px auto",
            fontWeight: "bold",
            fontSize: "1.25rem",
            lineHeight: "1.75rem",
            [`& .${gaugeClasses.valueArc}`]: {
              fill: "rgb(52 211 153)",
            },
          }}
        />
        <div>
          <div className="flex justify-between">
            <p>Free</p>
            <p>{formatBytes(free || NaN)}</p>
          </div>
          <div className="flex justify-between">
            <p>Total</p>
            <p>{formatBytes(total || NaN)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
