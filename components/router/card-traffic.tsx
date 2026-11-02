"use client";

import { cn, formatBytes } from "@/lib/utils";
import { Select } from "@headlessui/react";
import { LineChart } from "@mui/x-charts";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { MonitorTraffic } from "@/lib/router-types";

export default function CardTraffic({ id }: { id: number | undefined }) {
  const [mutating, setMutating] = useState<boolean>(false);

  const [interfaces, setInterfaces] = useState<string[]>([]);
  const loadInterface = async (signal?: AbortSignal) => {
    try {
      const resp = await fetch("/api/router/interface/" + id, { signal });
      const json = await resp.json();
      if (resp.status !== 200) throw new Error(json.message);
      
      const interfaceData = (Array.isArray(json) ? json : []) as { name?: string; "default-name"?: string }[];
      const names = interfaceData.map((val) => val?.name ?? val?.["default-name"] ?? "").filter(Boolean);
      setInterfaces(names);
      const first = names[0];
      if (first) {
        setSelect(first);
        setOldSelect(first);
      }
    } catch (err) {
      if (signal?.aborted) return;
      const error = err as Error;
      // console.error(error.message);
    } finally {
      setMutating(false);
    }
  };

  const [select, setSelect] = useState<string>();
  const [oldSelect, setOldSelect] = useState<string>();
  /** Cumulative bytes dari router; dipakai untuk hitung delta (bytes per interval). */
  const prevCumulativeRef = useRef<{ tx: number; rx: number } | null>(null);

  type TrafficState = {
    xData: string[];
    seriesDataTX: number[];
    seriesDataRX: number[];
  };
  const trafficState = {
    xData: [],
    seriesDataTX: [],
    seriesDataRX: [],
  };
  const trafficActs = (
    state: TrafficState,
    action:
      | {
          action: "edit";
          data: TrafficState;
        }
      | {
          action: "add";
          data: { tx: number; rx: number; x: string };
        }
      | { action: "clear" }
  ) => {
    switch (action.action) {
      case "edit":
        return {
          ...state,
          ...action.data,
        };
      case "add":
        return {
          seriesDataTX: [...state.seriesDataTX.slice(-4), action.data.tx],
          seriesDataRX: [...state.seriesDataRX.slice(-4), action.data.rx],
          xData: [...state.xData.slice(-4), action.data.x],
        };
      case "clear":
      default:
        return trafficState;
    }
  };
  const [traffic, trafficDispatch] = useReducer(trafficActs, trafficState);
  const loadInterfaceTraffic = useCallback(async (signal?: AbortSignal) => {
    try {
      if (!select) return;
      const resp = await fetch(
        "/api/router/interface/" + id + "/monitor/" + encodeURIComponent(select),
        { signal: signal }
      );
      if (!resp.ok) return;
      const resJson = await resp.json();
      const list = Array.isArray(resJson) ? resJson : [];
      const json = list.at(0) as MonitorTraffic | undefined;
      if (!json || (json.tx === undefined && json.rx === undefined)) return;
      const curTx = typeof json.tx === "string" ? parseInt(json.tx, 10) : Number(json.tx);
      const curRx = typeof json.rx === "string" ? parseInt(json.rx, 10) : Number(json.rx);
      const txNum = Number.isNaN(curTx) ? 0 : curTx;
      const rxNum = Number.isNaN(curRx) ? 0 : curRx;
      const prev = prevCumulativeRef.current;
      if (prev === null) {
        prevCumulativeRef.current = { tx: txNum, rx: rxNum };
        trafficDispatch({
          action: "add",
          data: { tx: 0, rx: 0, x: new Date().toLocaleTimeString("id-ID") },
        });
      } else {
        let deltaTx = txNum - prev.tx;
        let deltaRx = rxNum - prev.rx;
        if (deltaTx < 0) deltaTx = 0;
        if (deltaRx < 0) deltaRx = 0;
        prevCumulativeRef.current = { tx: txNum, rx: rxNum };
        trafficDispatch({
          action: "add",
          data: {
            tx: deltaTx,
            rx: deltaRx,
            x: new Date().toLocaleTimeString("id-ID"),
          },
        });
      }
      setOldSelect(select);
    } catch (err) {
      if (signal?.aborted) return;
      // Silently fail for background refresh to avoid UI spam
    } finally {
      setMutating(false);
    }
  }, [id, select]);
  useEffect(() => {
    if (!select) return;
    if (select !== oldSelect) {
      trafficDispatch({ action: "clear" });
      prevCumulativeRef.current = null;
      setMutating(true);
    }
    const controller = new AbortController();
    loadInterfaceTraffic(controller.signal);
    const int = setInterval(
      () => loadInterfaceTraffic(controller.signal),
      5000
    );
    return () => {
      clearInterval(int);
      controller.abort("New request");
    };
  }, [select, oldSelect, loadInterfaceTraffic]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    loadInterface(controller.signal);
    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when id changes; loadInterface uses id from closure
  }, [id]);

  return (
    <div className="rounded-md shadow-lg sm:col-span-2 flex flex-col overflow-hidden *:px-3 *:py-2">
      <div className="bg-slate-700 text-white">
        <p>Traffic</p>
      </div>
      <div className="bg-white dark:bg-theme-card text-slate-700 dark:text-theme-fg flex flex-col items-stretch gap-2">
        <div className="flex justify-end">
          <Select
            className={cn(
              "mt-3 block w-full appearance-none rounded-lg border-none bg-black/10 dark:bg-theme-muted py-1.5 px-3 text-sm/6 text-black dark:text-theme-fg",
              "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-black/25 dark:data-[focus]:outline-theme-border"
            )}
            value={select}
            onChange={(e) => {
              setSelect(e.target.value);
            }}
          >
            {interfaces.map((val) => (
              <option value={val} key={val}>
                {val}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-h-[250px] relative">
          {traffic.xData.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
              {!select
                ? "Pilih interface"
                : mutating
                  ? "Memuat data traffic..."
                  : "Menunggu data traffic dari router..."}
            </div>
          ) : (
            <LineChart
              skipAnimation
              loading={mutating}
              xAxis={[
                {
                  data: traffic.xData,
                  scaleType: "point",
                },
              ]}
              series={[
                {
                  data: traffic.seriesDataTX,
                  valueFormatter: (val) => {
                    if (!val) return "0";
                    return formatBytes(val);
                  },
                  label: "Download",
                  area: true,
                },
                {
                  data: traffic.seriesDataRX,
                  valueFormatter: (val) => {
                    if (!val) return "0";
                    return formatBytes(val);
                  },
                  label: "Upload",
                  area: true,
                  color: "yellow",
                },
              ]}
              yAxis={[
                {
                  valueFormatter: (val) => {
                    if (!val) return "";
                    return formatBytes(val);
                  },
                },
              ]}
              height={250}
              margin={{ left: 100 }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
