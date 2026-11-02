"use client";

import { Button, LinkButton } from "@/components/button";
import { Input } from "@/components/input";
import {
  DEFAULT_BILLING_GENERATE_DAY,
  DEFAULT_BILLING_GENERATE_HOUR,
} from "@/lib/billing-generate-config";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Settings = {
  billingGenerateDay: number;
  billingGenerateHour: number;
};

export default function BillingSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [day, setDay] = useState(String(DEFAULT_BILLING_GENERATE_DAY));
  const [hour, setHour] = useState(String(DEFAULT_BILLING_GENERATE_HOUR));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/settings", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat pengaturan");
      const data = json.data as Settings;
      setDay(String(data.billingGenerateDay));
      setHour(String(data.billingGenerateHour));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const billingGenerateDay = parseInt(day, 10);
    const billingGenerateHour = parseInt(hour, 10);
    if (
      !Number.isInteger(billingGenerateDay) ||
      billingGenerateDay < 1 ||
      billingGenerateDay > 28
    ) {
      toast.error("Tanggal generate harus 1–28");
      return;
    }
    if (
      !Number.isInteger(billingGenerateHour) ||
      billingGenerateHour < 0 ||
      billingGenerateHour > 23
    ) {
      toast.error("Jam generate harus 0–23");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/billing/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingGenerateDay, billingGenerateHour }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      toast.success(json.message || "Pengaturan disimpan");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex justify-center py-16 text-slate-500 dark:text-theme-fg-muted">
        <Loader2 className="animate-spin size-6 mr-2" />
        Memuat pengaturan...
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      <section className="flex flex-col md:grid md:grid-cols-3 gap-3 md:gap-4 w-full items-center">
        <div className="order-2 md:order-none" />
        <p className="flex justify-center font-medium items-center order-1 md:order-none">
          Pengaturan Billing
        </p>
        <LinkButton
          href="/billing/generate-log"
          color="slatesky"
          className="order-3 md:order-none w-full md:w-min md:justify-self-end text-xs py-1.5 px-3"
        >
          Log Generate
        </LinkButton>
      </section>

      <p className="text-sm text-slate-500 dark:text-theme-fg-muted text-center -mt-2">
        Jadwal default generate tagihan bulanan (zona WIB). Mitra tanpa tanggal
        khusus mengikuti setting ini.
      </p>

      <section className="w-full rounded-lg shadow-sm border border-slate-200 dark:border-theme-border bg-slate-50/80 dark:bg-theme-card/50 p-4 md:p-6 flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-theme-fg">
            Tanggal generate tagihan
            <Input
              type="number"
              min={1}
              max={28}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
            <span className="text-xs text-slate-500 dark:text-theme-fg-muted">
              1 – 28 setiap bulan. Contoh: 25 = generate setiap tanggal 25.
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-theme-fg">
            Jam generate (WIB)
            <Input
              type="number"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => setHour(e.target.value)}
            />
            <span className="text-xs text-slate-500 dark:text-theme-fg-muted">
              0 – 23. Cron harian memanggil endpoint; generate hanya saat jam
              cocok.
            </span>
          </label>
        </div>

        <p className="text-xs text-slate-500 dark:text-theme-fg-muted leading-snug border-t border-slate-200 dark:border-theme-border pt-4">
          Override per mitra: edit user Admin → field &quot;Tanggal Generate
          Tagihan&quot;. Kosong = pakai tanggal global di atas.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button loading={saving} onClick={() => void save()}>
            Simpan
          </Button>
        </div>
      </section>
    </div>
  );
}
