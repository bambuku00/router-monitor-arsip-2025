"use client";

import { useState } from "react";
import toast from "react-hot-toast";

type Channel = { code: string; name: string; group: string };

export default function TombolBayar({ pembayaranId }: { pembayaranId: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);

  async function buka() {
    setOpen(true);
    if (channels.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch("/pppoe/tripay/channel", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat kanal pembayaran");
      setChannels((json.data ?? []) as Channel[]);
    } catch (err) {
      toast.error((err as Error).message);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  async function bayar(method: string) {
    setLoading(true);
    try {
      const res = await fetch("/pppoe/tripay/bayar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pembayaranId, method }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat pembayaran");
      const checkoutUrl = String(json.data?.checkoutUrl ?? "");
      if (!checkoutUrl.startsWith("https://")) {
        throw new Error("Halaman pembayaran tidak tersedia.");
      }
      window.location.assign(checkoutUrl);
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      {open ? (
        <div className="grid gap-2">
          {loading && channels.length === 0 ? (
            <p className="text-sm text-slate-500">Memuat kanal pembayaran...</p>
          ) : null}
          {channels.map((item) => (
            <button
              key={item.code}
              type="button"
              disabled={loading}
              onClick={() => void bayar(item.code)}
              className="rounded-xl bg-[#c62828] px-3 py-2 text-left text-sm font-medium text-white disabled:opacity-60"
            >
              {item.name}
              {item.group ? (
                <span className="mt-0.5 block text-xs font-normal text-red-100">{item.group}</span>
              ) : null}
            </button>
          ))}
          {!loading && channels.length === 0 ? (
            <p className="text-sm text-slate-500">Kanal pembayaran belum tersedia.</p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void buka()}
          className="rounded-xl bg-[#c62828] px-4 py-2 text-sm font-medium text-white"
        >
          Bayar
        </button>
      )}
    </div>
  );
}
