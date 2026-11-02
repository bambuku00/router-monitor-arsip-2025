"use client";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { SELECT_BASE } from "@/lib/input-styles";
import {
  normalizePortalPin,
  normalizePortalSlug,
  normalizePortalWaCs,
  portalPinError,
  portalSlugError,
  portalWaCsError,
} from "@/lib/portal-slug";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

const cardClass =
  "w-full rounded-lg shadow-sm border border-slate-200 dark:border-theme-border bg-slate-50/80 dark:bg-theme-card/50 p-4 md:p-6 flex flex-col gap-5";
const labelClass =
  "flex flex-col gap-1.5 text-sm text-slate-700 dark:text-theme-fg";
const hintClass = "text-xs text-slate-500 dark:text-theme-fg-muted";
const checkClass =
  "flex items-center gap-2 text-sm text-slate-700 dark:text-theme-fg";

type SlugCheck = "idle" | "checking" | "free" | "taken" | "invalid";

type BersamaRow = {
  id: number;
  nama: string;
  slug: string;
  enabled: boolean;
  kontakMode: "beda" | "bersama";
  hasPin: boolean;
  wa: string | null;
  mitraIds: number[];
};

type LockedBersama = {
  nama: string;
  slug: string;
  kontakMode: "beda" | "bersama";
};

type PortalRow = {
  id: number;
  nama: string;
  enabled: boolean;
  slug: string | null;
  hasPin: boolean;
  wa: string | null;
};

export default function PortalSettingsForm({
  isSuperadmin,
}: {
  isSuperadmin: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mitra, setMitra] = useState<PortalRow[]>([]);
  const [bersama, setBersama] = useState<BersamaRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState("");
  const [pin, setPin] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [wa, setWa] = useState("");
  const [origin, setOrigin] = useState("");
  const [slugCheck, setSlugCheck] = useState<SlugCheck>("idle");
  const [slugMessage, setSlugMessage] = useState("");
  const [lockedBersama, setLockedBersama] = useState<LockedBersama[]>([]);

  const applyRow = useCallback((row: PortalRow) => {
    setSelectedId(row.id);
    setEnabled(row.enabled);
    setSlug(row.slug ?? "");
    setHasPin(row.hasPin === true);
    setPin("");
    setWa(row.wa ?? "");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/portal", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat pengaturan");
      if (isSuperadmin) {
        const rows = (json.data?.mitra ?? []) as PortalRow[];
        setMitra(rows);
        setBersama((json.data?.bersama ?? []) as BersamaRow[]);
        if (rows[0]) applyRow(rows[0]);
      } else if (json.data?.self) {
        setLockedBersama((json.data.lockedBersama ?? []) as LockedBersama[]);
        applyRow(json.data.self as PortalRow);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [applyRow, isSuperadmin]);

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, [load]);

  useEffect(() => {
    const clean = normalizePortalSlug(slug);
    if (selectedId == null || !clean) {
      setSlugCheck("idle");
      setSlugMessage("");
      return;
    }
    const formatErr = portalSlugError(clean, false);
    if (formatErr) {
      setSlugCheck("invalid");
      setSlugMessage(formatErr);
      return;
    }

    const ac = new AbortController();
    setSlugCheck("checking");
    setSlugMessage("Memeriksa...");
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({
            slug: clean,
            userId: String(selectedId),
          });
          const res = await fetch(`/api/settings/portal?${params}`, {
            cache: "no-store",
            signal: ac.signal,
          });
          const json = (await res.json()) as {
            available?: boolean;
            message?: string;
            error?: string;
          };
          if (!res.ok) throw new Error(json.error || "Gagal memeriksa link");
          if (json.available) {
            setSlugCheck("free");
            setSlugMessage(json.message || "Bisa dipakai.");
          } else {
            setSlugCheck("taken");
            setSlugMessage(json.message || "Sudah dipakai mitra lain.");
          }
        } catch (err) {
          if (ac.signal.aborted) return;
          setSlugCheck("invalid");
          setSlugMessage((err as Error).message);
        }
      })();
    }, 300);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [slug, selectedId]);

  const preview = useMemo(() => {
    const clean = slug.trim().toLowerCase();
    if (!clean) return "";
    return `${origin}/pppoe/${clean}`;
  }, [origin, slug]);

  const linkLocked = !isSuperadmin && lockedBersama.length > 0;
  const kontakLocked =
    linkLocked && lockedBersama.every((row) => row.kontakMode === "bersama");
  const ikutBersama =
    isSuperadmin && selectedId != null
      ? bersama.filter(
          (row) => row.enabled && row.mitraIds.includes(selectedId)
        )
      : [];
  const ikutKontakBersama =
    ikutBersama.length > 0 &&
    ikutBersama.every((row) => row.kontakMode === "bersama");

  async function save() {
    if (selectedId == null || kontakLocked) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/portal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedId,
          enabled,
          slug,
          pin,
          wa,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      const saved = json.data as PortalRow;
      setMitra((rows) =>
        rows.map((row) => (row.id === saved.id ? saved : row))
      );
      applyRow(saved);
      toast.success("Portal Pelanggan disimpan");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview);
      toast.success("Link disalin");
    } catch {
      toast.error("Gagal menyalin link");
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
          Portal Pelanggan
        </p>
        <div className="order-3 hidden md:order-none md:block" />
      </section>

      <p className="text-center text-sm text-slate-500 dark:text-theme-fg-muted -mt-2">
        {kontakLocked
          ? "PIN dan WhatsApp mengikuti pengaturan Superadmin."
          : linkLocked
            ? "Link portal milik Anda dikunci. PIN dan nomor WhatsApp tetap Anda atur sendiri."
            : "Tentukan link pelanggan dan hidupkan atau matikan portal mitra ini."}
      </p>

      <section className={cardClass}>
        {linkLocked ? (
          <ul className="grid gap-1 text-sm text-slate-600 dark:text-theme-fg-muted">
            {lockedBersama.map((row) => (
              <li key={row.slug}>
                Pelanggan masuk lewat{" "}
                <span className="font-medium">/pppoe/{row.slug}</span> ({row.nama}
                {row.kontakMode === "bersama"
                  ? ", PIN & WA bersama"
                  : ", PIN & WA mitra"}
                ).
              </li>
            ))}
          </ul>
        ) : null}
        {ikutBersama.length > 0 ? (
          <p className="text-sm text-slate-600 dark:text-theme-fg-muted">
            {ikutKontakBersama
              ? `Mitra ini mengikuti PIN dan WhatsApp link bersama${ikutBersama
                  .map((row) => ` /pppoe/${row.slug}`)
                  .join(",")}. Kolom itu dikunci di akun mitra.`
              : `Mitra ini mengatur PIN dan WhatsApp sendiri untuk link bersama${ikutBersama
                  .map((row) => ` /pppoe/${row.slug}`)
                  .join(",")}. Link portal miliknya tetap terkunci.`}
          </p>
        ) : null}

        {isSuperadmin ? (
          <label className={labelClass}>
            Mitra
            <select
              className={SELECT_BASE}
              value={selectedId ?? ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                const row = mitra.find((item) => item.id === id);
                if (row) applyRow(row);
              }}
            >
              {mitra.length === 0 ? (
                <option value="">Belum ada mitra</option>
              ) : null}
              {mitra.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.nama}
                  {row.enabled ? " · aktif" : " · nonaktif"}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className={checkClass}>
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={selectedId == null || linkLocked}
          />
          Hidupkan portal untuk pelanggan mitra ini
        </label>

        <label className={labelClass}>
          Link pelanggan
          <div className="flex items-center gap-1">
            <span className="shrink-0 text-slate-500 dark:text-theme-fg-muted">/pppoe/</span>
            <Input
              value={slug}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="nama-mitra"
              disabled={selectedId == null || linkLocked}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <span className={hintClass}>
            Huruf kecil, angka, dan tanda hubung, 3–32 karakter.
          </span>
          {slugMessage ? (
            <span
              className={
                slugCheck === "free"
                  ? "text-xs text-emerald-600"
                  : slugCheck === "checking"
                    ? hintClass
                    : "text-xs text-red-600"
              }
              role="status"
            >
              {slugMessage}
            </span>
          ) : null}
        </label>

        <label className={labelClass}>
          Nomor CS WhatsApp
          <Input
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            placeholder="08xxxxxxxxxx"
            value={wa}
            disabled={selectedId == null || kontakLocked}
            onChange={(e) => setWa(e.target.value.slice(0, 20))}
          />
          <span className={hintClass}>
            Nomor ini tampil di Portal Pelanggan sebagai tombol chat WhatsApp. Kosongkan jika tidak ingin menampilkan CS.
          </span>
          {wa && portalWaCsError(normalizePortalWaCs(wa)) ? (
            <span className="text-xs text-red-600" role="status">
              {portalWaCsError(normalizePortalWaCs(wa))}
            </span>
          ) : null}
        </label>

        <label className={labelClass}>
          PIN portal
          <Input
            type="password"
            autoComplete="new-password"
            maxLength={32}
            placeholder={hasPin ? "PIN sudah diatur" : "huruf, angka, atau karakter"}
            value={pin}
            disabled={selectedId == null || kontakLocked}
            onChange={(e) => setPin(e.target.value.slice(0, 32))}
          />
          <span className={hintClass}>
            {hasPin
              ? "PIN sudah diatur. Isi kolom ini hanya jika ingin mengganti. Boleh huruf, angka, dan karakter, 4–32 karakter."
              : "Boleh huruf, angka, dan karakter, 4–32 karakter. Pelanggan memasukkan PIN ini bersama nomor HP."}
          </span>
          {pin && portalPinError(normalizePortalPin(pin)) ? (
            <span className="text-xs text-red-600" role="status">
              {portalPinError(normalizePortalPin(pin))}
            </span>
          ) : null}
        </label>

        {preview ? (
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-theme-border dark:bg-theme-elevated">
            <span className="break-all text-slate-700 dark:text-theme-fg">{preview}</span>
            <div>
              <Button type="button" color="slatesky" onClick={() => void copyLink()}>
                Salin link
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-theme-border">
          <Button
            type="button"
            loading={saving}
            disabled={
              selectedId == null ||
              kontakLocked ||
              (!linkLocked &&
                (slugCheck === "checking" ||
                  slugCheck === "taken" ||
                  slugCheck === "invalid")) ||
              (!linkLocked && enabled && !normalizePortalSlug(slug)) ||
              Boolean(pin && portalPinError(normalizePortalPin(pin))) ||
              Boolean(wa && portalWaCsError(normalizePortalWaCs(wa))) ||
              (!linkLocked && enabled && !hasPin && !normalizePortalPin(pin))
            }
            onClick={() => void save()}
          >
            Simpan
          </Button>
        </div>
      </section>
      {isSuperadmin ? (
        <PortalBersamaPanel
          mitra={mitra}
          rows={bersama}
          origin={origin}
          onChange={setBersama}
        />
      ) : null}
    </div>
  );
}

function PortalBersamaPanel({
  mitra,
  rows,
  origin,
  onChange,
}: {
  mitra: PortalRow[];
  rows: BersamaRow[];
  origin: string;
  onChange: (rows: BersamaRow[]) => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nama, setNama] = useState("");
  const [slug, setSlug] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [kontakMode, setKontakMode] = useState<"beda" | "bersama">("beda");
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [wa, setWa] = useState("");
  const [mitraIds, setMitraIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setEditingId(null);
    setNama("");
    setSlug("");
    setEnabled(true);
    setKontakMode("beda");
    setHasPin(false);
    setPin("");
    setWa("");
    setMitraIds([]);
  }

  function edit(row: BersamaRow) {
    setEditingId(row.id);
    setNama(row.nama);
    setSlug(row.slug);
    setEnabled(row.enabled);
    setKontakMode(row.kontakMode === "bersama" ? "bersama" : "beda");
    setHasPin(row.hasPin === true);
    setPin("");
    setWa(row.wa ?? "");
    setMitraIds(row.mitraIds);
  }

  function toggleMitra(id: number) {
    setMitraIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/portal/bersama", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          nama,
          slug,
          enabled,
          mitraIds,
          kontakMode,
          pin,
          wa,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      const saved = json.data as BersamaRow;
      onChange(
        editingId
          ? rows.map((row) => (row.id === saved.id ? saved : row))
          : [...rows, saved].sort((a, b) => a.nama.localeCompare(b.nama, "id"))
      );
      resetForm();
      toast.success("Link portal bersama disimpan");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/settings/portal/bersama?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus");
      onChange(rows.filter((row) => row.id !== id));
      if (editingId === id) resetForm();
      toast.success("Link portal bersama dihapus");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const preview = slug.trim()
    ? `${origin}/pppoe/${slug.trim().toLowerCase()}`
    : "";

  return (
    <section className={cardClass}>
      <div className="border-b border-slate-200/80 pb-2 dark:border-theme-border/80">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-theme-fg">
          Satu link untuk beberapa mitra
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-theme-fg-muted">
          Pelanggan masuk lewat satu link. PIN dan WhatsApp bisa ikut tiap mitra, atau satu nomor yang ditentukan di sini.
        </p>
      </div>

      {rows.length > 0 ? (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-theme-border dark:bg-theme-elevated sm:flex-row sm:items-center sm:justify-between"
            >
              <span>
                <span className="font-medium text-slate-800 dark:text-theme-fg">{row.nama}</span>
                <span className="block text-xs text-slate-500 dark:text-theme-fg-muted">
                  /pppoe/{row.slug} · {row.mitraIds.length} mitra
                  {row.kontakMode === "bersama" ? " · PIN & WA bersama" : " · PIN & WA tiap mitra"}
                  {row.enabled ? "" : " · nonaktif"}
                </span>
              </span>
              <span className="flex gap-2">
                <Button
                  type="button"
                  color="slatesky"
                  className="px-2 py-1 text-xs"
                  onClick={() => edit(row)}
                >
                  Ubah
                </Button>
                <Button
                  type="button"
                  color="red"
                  className="px-2 py-1 text-xs"
                  disabled={saving}
                  onClick={() => void remove(row.id)}
                >
                  Hapus
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <label className={labelClass}>
        Nama portal
        <Input value={nama} maxLength={80} onChange={(e) => setNama(e.target.value)} />
      </label>
      <label className={labelClass}>
        Link bersama
        <div className="flex items-center gap-1">
          <span className="shrink-0 text-slate-500 dark:text-theme-fg-muted">/pppoe/</span>
          <Input
            value={slug}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="portal-bersama"
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
      </label>
      <label className={checkClass}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Hidupkan link ini
      </label>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold text-slate-800 dark:text-theme-fg">
          PIN dan WhatsApp
        </legend>
        <label className={checkClass}>
          <input
            type="radio"
            name="kontakMode"
            checked={kontakMode === "beda"}
            onChange={() => setKontakMode("beda")}
          />
          Beda tiap mitra. Mitra mengatur PIN dan WhatsApp sendiri.
        </label>
        <label className={checkClass}>
          <input
            type="radio"
            name="kontakMode"
            checked={kontakMode === "bersama"}
            onChange={() => setKontakMode("bersama")}
          />
          Satu PIN dan WhatsApp. Semua mitra di link ini mengikutinya.
        </label>
      </fieldset>
      {kontakMode === "bersama" ? (
        <>
          <label className={labelClass}>
            Nomor CS WhatsApp bersama
            <Input
              inputMode="tel"
              autoComplete="tel"
              maxLength={20}
              placeholder="08xxxxxxxxxx"
              value={wa}
              onChange={(e) => setWa(e.target.value.slice(0, 20))}
            />
            <span className={hintClass}>
              Kosongkan jika tombol WhatsApp tidak perlu ditampilkan.
            </span>
          </label>
          <label className={labelClass}>
            PIN bersama
            <Input
              type="password"
              autoComplete="new-password"
              maxLength={32}
              placeholder={hasPin ? "PIN bersama sudah diatur" : "4–32 karakter"}
              value={pin}
              onChange={(e) => setPin(e.target.value.slice(0, 32))}
            />
            <span className={hintClass}>
              Pelanggan di link ini memakai PIN ini. Isi lagi hanya jika ingin mengganti.
            </span>
          </label>
        </>
      ) : null}
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold text-slate-800 dark:text-theme-fg">
          Mitra yang digabung
        </legend>
        {mitra.map((row) => (
          <label key={row.id} className={checkClass}>
            <input
              type="checkbox"
              checked={mitraIds.includes(row.id)}
              onChange={() => toggleMitra(row.id)}
            />
            {row.nama}
          </label>
        ))}
      </fieldset>
      {preview ? (
        <p className="break-all rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-theme-border dark:bg-theme-elevated dark:text-theme-fg">
          {preview}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-theme-border">
        <Button
          type="button"
          loading={saving}
          disabled={
            nama.trim().length < 2 ||
            mitraIds.length < 2 ||
            !slug.trim() ||
            (kontakMode === "bersama" && !hasPin && pin.trim().length < 4) ||
            (kontakMode === "bersama" &&
              Boolean(pin && portalPinError(normalizePortalPin(pin)))) ||
            (kontakMode === "bersama" &&
              Boolean(wa && portalWaCsError(normalizePortalWaCs(wa))))
          }
          onClick={() => void save()}
        >
          {editingId ? "Simpan perubahan" : "Buat link bersama"}
        </Button>
        {editingId ? (
          <Button type="button" color="slatesky" onClick={resetForm}>
            Batal
          </Button>
        ) : null}
      </div>
    </section>
  );
}
