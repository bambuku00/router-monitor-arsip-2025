"use client";

import { Button } from "@/components/button";
import { getApiResponseErrorMessage } from "@/lib/get-error-message";
import { formatKapasitasMbps } from "@/lib/mikrotik-paket";
import { nominalPaketForDisplay } from "@/lib/paket-persist";
import {
  listPackageChangeTargets,
  type PackageChangeDirection,
} from "@/lib/ppp-package-change";
import type { GetPPP } from "@/lib/server-actions/router/ppp/actions";
import { ArrayElementType, cn } from "@/lib/utils";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { Paket } from "@prisma/client";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { TbArrowDown, TbArrowUp, TbBolt } from "react-icons/tb";

type Row = ArrayElementType<GetPPP["data"]>;

export type PackageChangeResult = {
  secretId: number;
  profile: string;
  kicked: boolean;
  kickPermissionDenied: boolean;
  direction: "upgrade" | "downgrade" | "booster";
  booster?: {
    profile: string;
    days: number;
    endsAt: string;
  } | null;
  paket: {
    id: number;
    nama: string;
    kapasitas: number;
    harga: number;
  };
};

export default function DialogPackageChange({
  row,
  routerId,
  pakets,
  profiles,
  isolirProfileName,
  ppn,
  packageChangeQuota,
  allowBooster = false,
  onClose,
  onSaved,
}: {
  row: Row | null;
  routerId: number;
  pakets: Paket[];
  profiles: string[];
  isolirProfileName?: string | null;
  ppn: number;
  packageChangeQuota?: {
    limit: number | null;
    upgradeUsed: number;
    downgradeUsed: number;
  } | null;
  allowBooster?: boolean;
  onClose: () => void;
  onSaved: (result: PackageChangeResult) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<PackageChangeDirection | "booster" | null>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [days, setDays] = useState(1);
  const [rowKey, setRowKey] = useState<number | null>(null);
  const open = row != null;
  if (row && rowKey !== row.id) {
    setRowKey(row.id);
    setDirection(null);
    setPickedId(null);
    setDays(1);
  }
  if (!row && rowKey !== null) {
    setRowKey(null);
    setDirection(null);
    setDays(1);
  }
  const current = row?.pelanggan?.paket;

  const targets = useMemo(() => {
    if (!row?.pelanggan || !current || !direction) return [];
    return listPackageChangeTargets({
      direction: direction === "booster" ? "upgrade" : direction,
      current: {
        id: row.pelanggan.paketId,
        nama: current.nama,
        kapasitas: current.kapasitas,
        harga: current.harga,
      },
      pakets: pakets
        .filter((paket) => !paket.deleted)
        .map((paket) => ({
          id: paket.id,
          nama: paket.nama,
          kapasitas: paket.kapasitas,
          harga: paket.harga,
        })),
      routerProfiles: profiles,
      isolirProfileName,
    });
  }, [current, direction, isolirProfileName, pakets, profiles, row?.pelanggan?.paketId]);

  const selectedId = pickedId ?? targets[0]?.id ?? null;
  const title =
    direction === "booster" ? "Booster" : direction === "downgrade" ? "Downgrade" : "Upgrade";
  const directionUsed = (kind: "upgrade" | "downgrade") =>
    kind === "downgrade"
      ? (packageChangeQuota?.downgradeUsed ?? 0)
      : (packageChangeQuota?.upgradeUsed ?? 0);
  const directionBlocked = (kind: "upgrade" | "downgrade") =>
    packageChangeQuota?.limit != null &&
    directionUsed(kind) >= packageChangeQuota.limit;
  const bothBlocked = directionBlocked("upgrade") && directionBlocked("downgrade");

  const close = () => {
    if (saving) return;
    onClose();
  };

  const submit = async () => {
    if (!row || !direction || selectedId == null) return;
    const isBooster = direction === "booster";
    setSaving(true);
    const toastLoad = toast.loading("Mengubah profil di Mikrotik...");
    try {
      const response = await fetch(
        isBooster
          ? `/api/router/${routerId}/ppp/booster`
          : `/api/router/${routerId}/ppp/paket`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isBooster
              ? { name: row.name, paketId: selectedId, days }
              : { name: row.name, paketId: selectedId, direction }
          ),
        }
      );
      const json = (await response.json().catch(() => null)) as
        | PackageChangeResult
        | { error?: string }
        | null;
      if (!response.ok || !json || !("profile" in json)) {
        throw new Error(
          getApiResponseErrorMessage(json, response, "Gagal mengubah profil dan paket")
        );
      }
      const done = isBooster
        ? "Profil booster aktif. Paket pelanggan tidak berubah."
        : "Profil dan paket diubah.";
      if (json.kickPermissionDenied) {
        toast(`${done} Sesi aktif tidak bisa diputus dari aplikasi.`, {
          id: toastLoad,
          icon: "⚠️",
        });
      } else if (json.kicked) {
        toast.success(`${done} Sesi aktif diputus.`, { id: toastLoad });
      } else {
        toast.success(`${done} Tidak ada sesi aktif.`, { id: toastLoad });
      }
      onSaved(json);
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengubah profil dan paket",
        { id: toastLoad }
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} as="div" className="relative z-[1001]" onClose={close}>
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black bg-opacity-25 duration-300 ease-out data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <DialogPanel
            transition
            className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-6 text-left text-gray-900 shadow-xl duration-300 ease-out data-[closed]:opacity-0"
          >
            <DialogTitle as="h3" className="text-base font-medium">
              {direction === "booster"
                ? "Booster profil"
                : direction
                  ? `${title} profil dan paket`
                  : "Ganti profil dan paket"}
            </DialogTitle>
            <p className="text-sm text-slate-600">
              {row?.pelanggan?.nama ? `${row.pelanggan.nama} · ` : ""}
              {row?.name}
              {direction === "booster"
                ? ". Hanya profil di Mikrotik yang berubah. Paket pelanggan tetap. Setelah hari yang dipilih, profil kembali seperti semula."
                : direction
                  ? ". Profil di Mikrotik ikut diganti, lalu sesi aktif diputus supaya profil baru langsung dipakai."
                  : allowBooster
                    ? ". Pilih upgrade, downgrade, atau booster."
                    : ". Pilih upgrade atau downgrade."}
            </p>
            {packageChangeQuota?.limit != null ? (
              <p className="text-xs text-slate-500">
                Upgrade {packageChangeQuota.upgradeUsed} dari {packageChangeQuota.limit}
                {" · "}
                Downgrade {packageChangeQuota.downgradeUsed} dari {packageChangeQuota.limit} bulan ini.
              </p>
            ) : null}
            {!direction && bothBlocked && !allowBooster ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {packageChangeQuota?.limit === 0
                  ? "Upgrade dan downgrade dimatikan untuk mitra ini."
                  : "Batas upgrade dan downgrade bulan ini sudah habis."}
              </p>
            ) : null}
            {!direction && (!bothBlocked || allowBooster) ? (
              <div className={cn("grid gap-2", allowBooster ? "grid-cols-3" : "grid-cols-2")}>
                <button
                  type="button"
                  disabled={directionBlocked("upgrade")}
                  className="flex flex-col items-center gap-1 rounded-lg bg-slate-100 px-3 py-4 text-sm font-medium hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setDirection("upgrade")}
                >
                  <TbArrowUp className="size-5 text-sky-600" />
                  Upgrade
                </button>
                <button
                  type="button"
                  disabled={directionBlocked("downgrade")}
                  className="flex flex-col items-center gap-1 rounded-lg bg-slate-100 px-3 py-4 text-sm font-medium hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setDirection("downgrade")}
                >
                  <TbArrowDown className="size-5 text-sky-600" />
                  Downgrade
                </button>
                {allowBooster ? (
                  <button
                    type="button"
                    className="flex flex-col items-center gap-1 rounded-lg bg-slate-100 px-3 py-4 text-sm font-medium hover:bg-sky-100"
                    onClick={() => setDirection("booster")}
                  >
                    <TbBolt className="size-5 text-sky-600" />
                    Booster
                  </button>
                ) : null}
              </div>
            ) : !direction ? null : targets.length === 0 ? (
              <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm">
                Tidak ada {direction === "booster" ? "profil" : "paket"}{" "}
                {direction === "downgrade" ? "lebih rendah" : "lebih tinggi"}.
              </p>
            ) : (
              <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
                {direction === "booster" ? (
                  <div className="grid grid-cols-6 gap-1">
                    {[1, 2, 3, 4, 5, 6].map((day) => (
                      <button
                        key={day}
                        type="button"
                        className={cn(
                          "rounded-lg px-1 py-2 text-xs font-medium",
                          days === day
                            ? "bg-sky-100 ring-2 ring-sky-500"
                            : "bg-slate-100 hover:bg-slate-200"
                        )}
                        onClick={() => setDays(day)}
                      >
                        {day} hari
                      </button>
                    ))}
                  </div>
                ) : null}
                {direction === "booster" ? (
                  <p className="text-xs text-slate-500">
                    1 hari dihitung 24 jam. Profil kembali sendiri setelah waktu itu.
                  </p>
                ) : null}
                {targets.map((target) => {
                  const active = selectedId === target.id;
                  return (
                    <button
                      key={target.id}
                      type="button"
                      className={cn(
                        "rounded-lg px-3 py-2 text-left text-sm",
                        active
                          ? "bg-sky-100 ring-2 ring-sky-500"
                          : "bg-slate-100 hover:bg-slate-200"
                      )}
                      onClick={() => setPickedId(target.id)}
                    >
                      <span className="font-medium">{target.nama}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        Profil {target.profile} · {formatKapasitasMbps(target.kapasitas)} ·{" "}
                        {nominalPaketForDisplay(
                          pakets.find((paket) => paket.id === target.id) ?? {
                            harga: target.harga,
                            nominalPembayaran: null,
                          },
                          ppn
                        ).toLocaleString("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-1 flex justify-end gap-2">
              {direction ? (
                <Button
                  color="slatesky"
                  onClick={() => {
                    setDirection(null);
                    setPickedId(null);
                  }}
                  disabled={saving}
                >
                  Kembali
                </Button>
              ) : (
                <Button color="slatesky" onClick={close} disabled={saving}>
                  Batal
                </Button>
              )}
              {direction ? (
                <Button color="sky" onClick={submit} disabled={saving || selectedId == null}>
                  {saving ? "Menyimpan..." : title}
                </Button>
              ) : null}
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
