"use client";

import { Gauge } from "@mui/x-charts";

export default function CardCPU({
  load,
  count,
  frequency,
  uptime,
}: {
  load: number | undefined;
  count: number | undefined;
  frequency: number | undefined;
  uptime: string | undefined;
}) {
  return (
    <div className="rounded-md shadow-lg flex flex-col overflow-hidden *:px-3 *:py-2">
      <div className="text-white bg-slate-700">
        <p>CPU</p>
      </div>
      <div className="bg-white dark:bg-theme-card text-slate-700 dark:text-theme-fg flex flex-col items-stretch gap-2">
        <Gauge
          width={180}
          height={180}
          value={load}
          startAngle={-90}
          endAngle={90}
          text={({ value }) => (value || 0) + "%"}
          sx={{
            margin: "0px auto",
            fontWeight: "bold",
            fontSize: "1.25rem",
            lineHeight: "1.75rem",
          }}
        />
        <div>
          <div className="flex justify-between">
            <p>CPU Count</p>
            <p>{count}</p>
          </div>
          <div className="flex justify-between">
            <p>CPU Frequency</p>
            <p>{(frequency || "") + " MHz"}</p>
          </div>
          <div className="flex justify-between">
            <p>Up Time</p>
            <p>{uptime}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
