"use client";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { ISOLIR_SETUP_CHECKLIST, ISOLIR_MIKROTIK_HTML_FILE, ISOLIR_MIKROTIK_HTML_PATH } from "@/lib/mikrotik/isolir-setup";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Router } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useState, type MouseEvent } from "react";
import toast from "react-hot-toast";
import { TbDownload, TbSettingsAutomation } from "react-icons/tb";

type Props = {
  router: Pick<Router, "id" | "nama" | "os_version">;
  /** Hanya Admin / Superadmin */
  canManage?: boolean;
  variant?: "button" | "menu";
  onBeforeOpen?: () => void;
  /** Dialog dikontrol dari luar — dipakai saat trigger ada di menu tooltip */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

export default function IsolirSetupDialog({
  router,
  canManage = false,
  variant = "button",
  onBeforeOpen,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };
  const [loading, setLoading] = useState<"save" | "mikrotik" | null>(null);
  const [gatewayIp, setGatewayIp] = useState("");
  const [profileName, setProfileName] = useState("isolir");
  const [downloadingHtml, setDownloadingHtml] = useState(false);
  const rosType =
    router.os_version === "v7"
      ? "ros7"
      : router.os_version === "v6"
        ? "ros6"
        : null;
  const navigation = useRouter();

  const downloadErrorHtml = useCallback(async () => {
    setDownloadingHtml(true);
    try {
      const res = await fetch("/isolir/error.html", { cache: "no-store" });
      if (!res.ok) throw new Error("File tidak ditemukan");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = ISOLIR_MIKROTIK_HTML_FILE;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(
        `${ISOLIR_MIKROTIK_HTML_FILE} terunduh — upload ke Mikrotik folder webproxy`
      );
    } catch (err) {
      toast.error((err as Error).message || "Gagal mengunduh file");
    } finally {
      setDownloadingHtml(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    fetch(`/api/router/${router.id}/isolir-setup`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        const cfg = json.data;
        if (!cfg) return;
        if (cfg.isolirProfileName) setProfileName(cfg.isolirProfileName);
        if (cfg.isolirGatewayIp) setGatewayIp(cfg.isolirGatewayIp);
      })
      .catch(() => {});
  }, [open, router.id]);

  const handleSaveProfileOnly = async () => {
    if (!profileName.trim()) {
      toast.error("Masukkan nama profil isolir");
      return;
    }

    setLoading("save");
    const toastId = toast.loading("Menyimpan nama profil isolir...");
    try {
      const resp = await fetch(`/api/router/${router.id}/isolir-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileName: profileName.trim(),
          saveProfileOnly: true,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Gagal menyimpan nama profil");

      toast.success(
        "Nama profil isolir tersimpan di billing. MikroTik tidak diubah.",
        { id: toastId }
      );
      navigation.refresh();
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setLoading(null);
    }
  };

  const handleSubmit = async () => {
    if (!rosType) {
      toast.error("Versi RouterOS belum tercatat di data router");
      return;
    }
    if (!gatewayIp.trim()) {
      toast.error("Masukkan IP gateway internet");
      return;
    }

    setLoading("mikrotik");
    const toastId = toast.loading("Mengirim konfigurasi isolir ke Mikrotik...");
    try {
      const resp = await fetch(`/api/router/${router.id}/isolir-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rosType,
          gatewayIp: gatewayIp.trim(),
          profileName: profileName.trim() || "isolir",
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Gagal setup isolir");

      const created = (json.data?.steps as { status: string }[] | undefined)?.filter(
        (s) => s.status === "created"
      ).length;
      const skipped = (json.data?.steps as { status: string }[] | undefined)?.filter(
        (s) => s.status === "skipped"
      ).length;

      toast.success(
        created
          ? `Setup isolir selesai (${created} baru${skipped ? `, ${skipped} sudah ada` : ""}). Langkah berikutnya: unduh & upload ${ISOLIR_MIKROTIK_HTML_FILE} ke webproxy.`
          : `Konfigurasi isolir sudah ada di router. Pastikan ${ISOLIR_MIKROTIK_HTML_FILE} sudah di-upload ke webproxy.`,
        { id: toastId, duration: 6000 }
      );
      navigation.refresh();
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setLoading(null);
    }
  };

  const openDialog = (e?: MouseEvent) => {
    e?.stopPropagation();
    onBeforeOpen?.();
    window.setTimeout(() => setOpen(true), 0);
  };

  if (!canManage) return null;

  return (
    <>
      {!hideTrigger &&
        (variant === "menu" ? (
          <button
            type="button"
            className="hover:bg-slate-100 flex gap-2 items-center py-1 px-2 rounded cursor-pointer w-full text-left"
            onClick={openDialog}
          >
            <TbSettingsAutomation className="size-4 shrink-0" />
            <p>Setup Isolir</p>
          </button>
        ) : (
          <Button
            type="button"
            color="cyan100"
            className="text-xs py-0.5 px-2 gap-1 rounded-md font-medium whitespace-nowrap shrink-0"
            onClick={openDialog}
          >
            <TbSettingsAutomation className="size-3.5 shrink-0" />
            Setup Isolir
          </Button>
        ))}

      <Transition appear show={open} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[1001]"
          onClose={() => !loading && setOpen(false)}
        >
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-lg rounded-2xl bg-white dark:bg-theme-card p-6 shadow-xl text-left">
                  <DialogTitle className="text-base font-semibold text-slate-800 dark:text-theme-fg">
                    Setup Isolir PPPoE — {router.nama}
                  </DialogTitle>
                  <p className="mt-1 text-xs text-slate-500 dark:text-theme-fg-muted">
                    {rosType === "ros7"
                      ? "RouterOS v7"
                      : rosType === "ros6"
                        ? "RouterOS v6"
                        : "Versi RouterOS belum tercatat di data router"}
                  </p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-sm font-medium block mb-1.5">
                        IP gateway internet (redirect halaman isolir)
                      </label>
                      <Input
                        value={gatewayIp}
                        onChange={(e) => setGatewayIp(e.target.value)}
                        placeholder="Contoh: 172.16.1.1"
                        disabled={loading !== null}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium block mb-1.5">
                        Nama profil / pool isolir
                      </label>
                      <Input
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="isolir"
                        disabled={loading !== null}
                      />
                      <p className="mt-1.5 text-xs text-slate-500 dark:text-theme-fg-muted">
                        Jika MikroTik sudah punya pengaturan isolir, simpan nama
                        profil ini saja. Billing memakai nama tersebut tanpa
                        mengirim konfigurasi ke router.
                      </p>
                    </div>

                    <div className="rounded-lg bg-sky-50 dark:bg-sky-950/25 border border-sky-200 dark:border-sky-800/50 p-3 space-y-3">
                      <div>
                        <p className="text-sm font-medium text-sky-900 dark:text-sky-100">
                          Halaman isolir Mikrotik ({ISOLIR_MIKROTIK_HTML_FILE})
                        </p>
                        <p className="text-xs text-sky-800/80 dark:text-sky-200/80 mt-1">
                          Setelah setup, pelanggan isolir melihat halaman ini.
                          Unduh dulu, lalu upload ke router — nama file harus tetap{" "}
                          <strong>{ISOLIR_MIKROTIK_HTML_FILE}</strong>.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          color="sky"
                          className="text-xs py-1.5 px-3 gap-1.5"
                          loading={downloadingHtml}
                          onClick={() => void downloadErrorHtml()}
                        >
                          <TbDownload className="size-4 shrink-0" />
                          Unduh {ISOLIR_MIKROTIK_HTML_FILE}
                        </Button>
                        <Link
                          href="/isolir/error.html"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs py-1.5 px-3 rounded-md border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
                        >
                          Pratinjau di tab baru
                        </Link>
                      </div>
                      <ol className="list-decimal pl-4 space-y-2 text-xs text-slate-700 dark:text-theme-fg-muted">
                        <li>
                          Klik <strong>Unduh {ISOLIR_MIKROTIK_HTML_FILE}</strong> di atas
                          (file masuk folder Download komputer Anda).
                        </li>
                        <li>
                          Di Winbox/WebFig router: <strong>IP → Web Proxy → Reset HTML → Yes</strong>
                          . Folder <code className="font-mono bg-white/60 dark:bg-black/20 px-1 rounded">webproxy</code> akan dibuat.
                        </li>
                        <li>
                          Buka menu <strong>Files → webproxy</strong>, hapus atau timpa{" "}
                          <code className="font-mono bg-white/60 dark:bg-black/20 px-1 rounded">{ISOLIR_MIKROTIK_HTML_FILE}</code>{" "}
                          bawaan Mikrotik dengan file yang baru diunduh (drag & drop atau Upload).
                        </li>
                        <li>
                          Jangan ubah nama file — Mikrotik hanya membaca{" "}
                          <code className="font-mono bg-white/60 dark:bg-black/20 px-1 rounded">{ISOLIR_MIKROTIK_HTML_PATH}</code>.
                        </li>
                      </ol>
                    </div>

                    <div className="rounded-lg bg-slate-50 dark:bg-theme-elevated border border-slate-200 dark:border-theme-border p-3 text-xs text-slate-600 dark:text-theme-fg-muted space-y-1">
                      <p className="font-medium text-slate-700 dark:text-theme-fg">
                        Yang akan dikirim ke Mikrotik:
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {ISOLIR_SETUP_CHECKLIST.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      color="red100"
                      disabled={loading !== null}
                      onClick={() => setOpen(false)}
                    >
                      Batal
                    </Button>
                    <Button
                      type="button"
                      color="sky"
                      disabled={loading !== null}
                      loading={loading === "save"}
                      loadingMessage="Menyimpan..."
                      onClick={() => void handleSaveProfileOnly()}
                    >
                      Simpan nama profil saja
                    </Button>
                    <Button
                      type="button"
                      color="green100"
                      disabled={loading !== null}
                      loading={loading === "mikrotik"}
                      loadingMessage="Memproses..."
                      onClick={() => void handleSubmit()}
                    >
                      Proses ke Mikrotik
                    </Button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
