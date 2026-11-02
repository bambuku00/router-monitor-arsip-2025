"use client";

import { useEffect, useRef, useState } from "react";
import { ToolNetwatch } from "@/lib/router-types";

export default function CardClient({ id }: { id: number | undefined }) {
  const [netWatch, setNetWatch] = useState<ToolNetwatch[]>([]);
  const loadNetWatch = async (signal?: AbortSignal) => {
    try {
      const resp = await fetch(`/api/router/netwatch/${id}`, { signal });
      const json = await resp.json();
      if (resp.status !== 200) throw new Error(json?.message ?? resp.statusText);
      setNetWatch(Array.isArray(json) ? json : []);
    } catch (err) {
      if (signal?.aborted) return;
      setNetWatch([]);
    }
  };

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();

    loadNetWatch(controller.signal);
    const dataInterval = setInterval(() => loadNetWatch(controller.signal), 5000);

    return () => {
      clearInterval(dataInterval);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when id changes; loadNetWatch uses id from closure
  }, [id]);

  return (
    <div className="rounded-md shadow-lg flex flex-col overflow-hidden *:px-3 *:py-2">
      <div className="text-white bg-slate-700">
        <p>Client</p>
      </div>
      <div className="bg-white dark:bg-theme-card text-slate-700 dark:text-theme-fg flex flex-col items-stretch gap-2">
        <table>
          <thead>
            <tr>
              <td>Host</td>
              <td>Timeout</td>
              <td>Interval</td>
              <td>Status</td>
            </tr>
          </thead>
          <tbody>
            {netWatch.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-slate-500 text-sm py-4 text-center">
                  Tidak ada netwatch dikonfigurasi di router
                </td>
              </tr>
            ) : (
              netWatch.map((val, idx) => (
                <tr key={val.id || idx}>
                  <td>{val.host}</td>
                  <td>{val.timeout}</td>
                  <td>{val.interval}</td>
                  <td>{val.status?.toUpperCase() ?? ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
