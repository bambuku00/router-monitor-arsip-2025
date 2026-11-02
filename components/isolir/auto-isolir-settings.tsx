"use client";

import { Button, LinkButton } from "@/components/button";
import { Input } from "@/components/input";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Settings = {
  enabled: boolean;
  toleranceDays: number;
  executeTime: string;
  isolirProfileName: string;
  onlyActiveCustomers: boolean;
  notifyBefore: boolean;
  notifyAfter: boolean;
  autoRestoreOnPayment: boolean;
};

type RunResult = {
  batchId: string;
  dryRun: boolean;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  items: {
    pelangganNama: string;
    pppUsername: string;
    jatuh_tempo?: string;
    status: string;
    errorMessage?: string;
  }[];
};

function SettingCheckbox({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 cursor-pointer text-sm text-slate-700 dark:text-theme-fg",
        disabled && "opacity-60 cursor-not-allowed"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="size-4 rounded mt-0.5 shrink-0 accent-sky-600"
      />
      <span>{children}</span>
    </label>
  );
}

export default function AutoIsolirSettingsPage({ userId }: { userId: number }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<RunResult | null>(null);
  const [form, setForm] = useState<Settings>({
    enabled: false,
    toleranceDays: 1,
    executeTime: "00:10",
    isolirProfileName: "ISOLIR",
    onlyActiveCustomers: true,
    notifyBefore: false,
    notifyAfter: false,
    autoRestoreOnPayment: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/auto-isolir/settings?userId=${userId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat pengaturan");
      if (json.data) {
        setForm({
          enabled: json.data.enabled,
          toleranceDays: json.data.toleranceDays,
          executeTime: json.data.executeTime,
          isolirProfileName: json.data.isolirProfileName,
          onlyActiveCustomers: json.data.onlyActiveCustomers,
          notifyBefore: json.data.notifyBefore,
          notifyAfter: json.data.notifyAfter,
          autoRestoreOnPayment: json.data.autoRestoreOnPayment ?? true,
        });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/auto-isolir/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      toast.success("Pengaturan auto isolir disimpan");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const runJob = async (dryRun: boolean) => {
    setRunning(true);
    if (dryRun) setDryRunResult(null);
    const toastId = toast.loading(
      dryRun ? "Simulasi auto isolir..." : "Menjalankan auto isolir..."
    );
    try {
      const res = await fetch("/api/auto-isolir/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, dryRun }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menjalankan");
      const data = json.data as RunResult;
      if (dryRun) setDryRunResult(data);
      toast.success(
        dryRun
          ? `Simulasi: ${data.processed} pelanggan (${data.success} akan diisolir, ${data.skipped} dilewati, ${data.failed} gagal)`
          : `Selesai: ${data.success} isolir, ${data.failed} gagal, ${data.skipped} dilewati`,
        { id: toastId, duration: 6000 }
      );
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setRunning(false);
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
          Isolir Otomatis
        </p>
        <LinkButton
          href="/isolir/log"
          color="slatesky"
          className="order-3 md:order-none w-full md:w-min md:justify-self-end text-xs py-1.5 px-3"
        >
          Riwayat Log
        </LinkButton>
      </section>

      <p className="text-sm text-slate-500 dark:text-theme-fg-muted text-center -mt-2">
        Isolir pelanggan overdue berdasarkan tanggal isolir per pelanggan + toleransi.
        Pelanggan tanpa tanggal isolir hanya bisa diisolir manual.
      </p>

      <section className="w-full rounded-lg shadow-sm border border-slate-200 dark:border-theme-border bg-slate-50/80 dark:bg-theme-card/50 p-4 md:p-6 flex flex-col gap-5">
        <SettingCheckbox
          checked={form.enabled}
          onChange={(enabled) => setForm((f) => ({ ...f, enabled }))}
        >
          <span className="font-medium">Auto isolir aktif</span>
        </SettingCheckbox>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-theme-fg">
            Hari toleransi setelah tanggal isolir
            <Input
              type="number"
              min={0}
              max={30}
              value={form.toleranceDays}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  toleranceDays: parseInt(e.target.value, 10) || 0,
                }))
              }
            />
            <span className="text-xs text-slate-500 dark:text-theme-fg-muted">
              Contoh: tanggal isolir 22 + toleransi 2 → auto isolir tanggal 24 (bulan tagihan).
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-theme-fg">
            Jam eksekusi (HH:mm, WIB)
            <Input
              value={form.executeTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, executeTime: e.target.value }))
              }
              placeholder="08:10"
            />
            <span className="text-xs text-slate-500 dark:text-theme-fg-muted">
              Jadwal harian auto isolir otomatis. Simpan pengaturan setelah mengubah jam.
              Cron server harus memanggil job setiap menit (pasang ulang lewat teknisi jika masih 00:10).
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-theme-fg sm:col-span-2">
            Profile isolir MikroTik (default jika router belum setup)
            <Input
              value={form.isolirProfileName}
              onChange={(e) =>
                setForm((f) => ({ ...f, isolirProfileName: e.target.value }))
              }
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-theme-border pt-4">
          <SettingCheckbox
            checked={form.onlyActiveCustomers}
            onChange={(onlyActiveCustomers) =>
              setForm((f) => ({ ...f, onlyActiveCustomers }))
            }
          >
            Hanya isolir pelanggan dengan sesi PPP aktif (online)
          </SettingCheckbox>

          <SettingCheckbox
            checked={form.autoRestoreOnPayment}
            onChange={(autoRestoreOnPayment) =>
              setForm((f) => ({ ...f, autoRestoreOnPayment }))
            }
          >
            Buka isolir otomatis saat tagihan lunas
          </SettingCheckbox>

          <SettingCheckbox checked={form.notifyBefore} disabled>
            Kirim notifikasi sebelum isolir (belum tersedia)
          </SettingCheckbox>

          <SettingCheckbox checked={form.notifyAfter} disabled>
            Kirim notifikasi setelah isolir (belum tersedia)
          </SettingCheckbox>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-theme-border">
          <Button color="sky700" disabled={saving} loading={saving} onClick={save}>
            Simpan Pengaturan
          </Button>
          <Button
            color="slatesky"
            disabled={running}
            loading={running}
            onClick={() => runJob(true)}
          >
            Dry Run / Simulasi
          </Button>
          <Button
            color="amber"
            disabled={running}
            loading={running}
            onClick={() => runJob(false)}
          >
            Jalankan Sekarang
          </Button>
        </div>
      </section>

      {dryRunResult ? (
        <section className="w-full rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-4 shadow-sm">
          <h2 className="font-medium text-sm mb-3 text-amber-900 dark:text-amber-200">
            Hasil simulasi ({dryRunResult.processed} pelanggan)
          </h2>
          {dryRunResult.items.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-theme-fg-muted">
              Tidak ada pelanggan yang memenuhi syarat isolir saat ini.
            </p>
          ) : (
            <ul className="text-sm max-h-64 overflow-y-auto space-y-1.5 text-slate-700 dark:text-theme-fg">
              {dryRunResult.items.map((item, i) => (
                <li
                  key={i}
                  className={cn(
                    "px-2 py-1 rounded",
                    item.status === "failed" &&
                      "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30",
                    item.status === "skipped" &&
                      "text-slate-500 dark:text-theme-fg-muted",
                    item.status === "success" &&
                      "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20"
                  )}
                >
                  {item.pelangganNama} ({item.pppUsername})
                  {item.jatuh_tempo
                    ? ` — tagihan ${item.jatuh_tempo.slice(0, 7)}`
                    : ""}{" "}
                  — {item.status}
                  {item.errorMessage ? `: ${item.errorMessage}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
