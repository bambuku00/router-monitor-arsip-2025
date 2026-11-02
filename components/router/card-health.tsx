"use client";

import { Gauge, gaugeClasses } from "@mui/x-charts";

export default function CardHealth({
  temp,
  volt,
  board,
}: {
  temp: number | undefined;
  volt: number | undefined;
  board: string | undefined;
}) {
  return (
    <div className="rounded-md shadow-lg flex flex-col overflow-hidden *:px-3 *:py-2">
      <div className="text-white bg-slate-700">
        <p>Health</p>
      </div>
      <div className="bg-white dark:bg-theme-card text-slate-700 dark:text-theme-fg flex flex-col items-stretch gap-2">
        <Gauge
          width={180}
          height={180}
          value={temp}
          startAngle={-90}
          endAngle={90}
          valueMax={105}
          text={({ value }) => (value || 0) + "°C"}
          sx={{
            margin: "0px auto",
            fontWeight: "bold",
            fontSize: "1.25rem",
            lineHeight: "1.75rem",
            [`& .${gaugeClasses.valueArc}`]: {
              fill: "rgb(249 115 22)",
            },
          }}
        />
        <div>
          <div className="flex justify-between">
            <p>Board</p>
            <p>{board}</p>
          </div>
          <div className="flex justify-between">
            <p>Voltage</p>
            <p>{(volt || 0) + " V"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
