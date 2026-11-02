"use client";

import { useEffect, useState } from "react";

type Ringkas = {
  saldo: number;
};

function rp(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}Rp ${Math.abs(value).toLocaleString("id-ID")}`;
}

const REFRESH_MS = 15_000;

export function KomisiPetugasRingkas({ refreshToken = 0 }: { refreshToken?: number }) {
  const [ringkas, setRingkas] = useState<Ringkas>({
    saldo: 0,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let ignore = false;

    const load = () => {
      void fetch("/api/penagih/komisi/saya", { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) return null;
          return (await res.json()) as { ringkas?: Ringkas };
        })
        .then((json) => {
          if (ignore) return;
          if (json?.ringkas) setRingkas(json.ringkas);
          setReady(true);
        })
        .catch(() => {
          if (!ignore) setReady(true);
        });
    };

    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      ignore = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refreshToken]);

  return (
    <div className="col-span-3 pt-1">
      <div className="rounded-2xl border border-violet-200 bg-violet-100 px-3 py-2 shadow-sm dark:border-violet-800 dark:bg-violet-950/50">
        <p className="text-[11px] font-medium text-violet-800 dark:text-violet-200">
          Total komisi masuk
        </p>
        <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">
          {ready ? rp(ringkas.saldo) : "..."}
        </p>
      </div>
    </div>
  );
}
