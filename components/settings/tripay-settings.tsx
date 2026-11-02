"use client";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { SELECT_BASE } from "@/lib/input-styles";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const cardClass =
  "w-full rounded-lg shadow-sm border border-slate-200 dark:border-theme-border bg-slate-50/80 dark:bg-theme-card/50 p-4 md:p-6 flex flex-col gap-5";
const labelClass =
  "flex flex-col gap-1.5 text-sm text-slate-700 dark:text-theme-fg";
const hintClass = "text-xs text-slate-500 dark:text-theme-fg-muted";
const checkClass =
  "flex items-center gap-2 text-sm text-slate-700 dark:text-theme-fg";

type GatewayRow = {
  id: number;
  nama: string;
  enabled: boolean;
  sandbox: boolean;
  merchantCode: string;
  hasApiKey: boolean;
  hasPrivateKey: boolean;
};

export default function TripaySettingsForm({
  isSuperadmin,
}: {
  isSuperadmin: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mitra, setMitra] = useState<GatewayRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [sandbox, setSandbox] = useState(true);
  const [merchantCode, setMerchantCode] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [hasPrivateKey, setHasPrivateKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");

  const applyRow = useCallback((row: GatewayRow) => {
    setSelectedId(row.id);
    setEnabled(row.enabled);
    setSandbox(row.sandbox);
    setMerchantCode(row.merchantCode);
    setHasApiKey(row.hasApiKey);
    setHasPrivateKey(row.hasPrivateKey);
    setApiKey("");
    setPrivateKey("");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/tripay", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat pengaturan");
      if (isSuperadmin) {
        const rows = (json.data?.mitra ?? []) as GatewayRow[];
        setMitra(rows);
        if (rows[0]) applyRow(rows[0]);
      } else if (json.data?.self) {
        applyRow(json.data.self as GatewayRow);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [applyRow, isSuperadmin]);

  useEffect(() => {
    setCallbackUrl(`${window.location.origin}/api/tripay/callback`);
    void load();
  }, [load]);

  async function save() {
    if (selectedId == null) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/tripay", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedId,
          enabled,
          sandbox,
          merchantCode,
          apiKey,
          privateKey,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      const saved = json.data as GatewayRow;
      setMitra((rows) => rows.map((row) => (row.id === saved.id ? saved : row)));
      applyRow(saved);
      toast.success(saved.enabled ? "Payment gateway Tripay dihidupkan" : "Payment gateway Tripay dimatikan");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex w-full justify-center py-16 text-slate-500 dark:text-theme-fg-muted">
        <Loader2 className="mr-2 size-6 animate-spin" />
        Memuat pengaturan...
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <section className="flex w-full flex-col items-center gap-3 md:grid md:grid-cols-3 md:gap-4">
        <div className="order-2 hidden md:order-none md:block" />
        <p className="order-1 flex items-center justify-center font-medium text-slate-800 dark:text-theme-fg md:order-none">
          Payment Gateway Tripay
        </p>
        <div className="order-3 hidden md:order-none md:block" />
      </section>

      <p className="text-center text-sm text-slate-500 dark:text-theme-fg-muted -mt-2">
        Hidupkan gateway ini supaya pelanggan bisa membayar tagihan dari portal.
      </p>

      <section className={cardClass}>
        {isSuperadmin ? (
          <label className={labelClass}>
            Mitra
            <select
              className={SELECT_BASE}
              value={selectedId ?? ""}
              onChange={(e) => {
                const row = mitra.find((item) => item.id === Number(e.target.value));
                if (row) applyRow(row);
              }}
            >
              {mitra.length === 0 ? <option value="">Belum ada mitra</option> : null}
              {mitra.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.nama}
                  {row.enabled ? " · hidup" : " · mati"}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className={checkClass}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={selectedId == null}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Hidupkan payment gateway Tripay
        </label>
        <label className={checkClass}>
          <input
            type="checkbox"
            checked={sandbox}
            disabled={selectedId == null}
            onChange={(e) => setSandbox(e.target.checked)}
          />
          Mode sandbox untuk uji coba
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Kode merchant
            <Input
              value={merchantCode}
              maxLength={32}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={selectedId == null}
              onChange={(e) => setMerchantCode(e.target.value.slice(0, 32))}
            />
          </label>
          <label className={labelClass}>
            API key
            <Input
              type="password"
              autoComplete="new-password"
              value={apiKey}
              maxLength={200}
              placeholder={hasApiKey ? "API key sudah tersimpan" : "API key Tripay"}
              disabled={selectedId == null}
              onChange={(e) => setApiKey(e.target.value.slice(0, 200))}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Private key
            <Input
              type="password"
              autoComplete="new-password"
              value={privateKey}
              maxLength={200}
              placeholder={hasPrivateKey ? "Private key sudah tersimpan" : "Private key Tripay"}
              disabled={selectedId == null}
              onChange={(e) => setPrivateKey(e.target.value.slice(0, 200))}
            />
            <span className={hintClass}>Isi lagi hanya jika kunci ingin diganti.</span>
          </label>
        </div>

        {callbackUrl ? (
          <p className="break-all rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-theme-border dark:bg-theme-elevated dark:text-theme-fg">
            URL callback Tripay
            <span className="mt-1 block font-medium">{callbackUrl}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-theme-border">
          <Button
            type="button"
            loading={saving}
            disabled={
              selectedId == null ||
              (enabled &&
                (!merchantCode.trim() ||
                  (!hasApiKey && !apiKey.trim()) ||
                  (!hasPrivateKey && !privateKey.trim())))
            }
            onClick={() => void save()}
          >
            Simpan
          </Button>
        </div>
      </section>
    </div>
  );
}
