"use client";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import DialogRekapMetode from "@/components/penagihan/dialog-rekap-metode";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Field,
  Label,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  TbCalculator,
  TbCircleCheck,
  TbCircleOff,
  TbEdit,
  TbTrash,
  TbUserPlus,
} from "react-icons/tb";

type Mitra = { id: number; nama: string };
type Petugas = {
  id: number;
  nama: string;
  nomor: string | null;
  aktif: boolean;
  jumlahPelanggan: number;
  akunUser: string | null;
  komisiNominal: number;
  komisiSaldo: number;
  komisiDibatalkan: number;
};

function rp(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}Rp ${Math.abs(value).toLocaleString("id-ID")}`;
}

const tableWrap = "w-full overflow-x-auto rounded text-sm shadow hidden md:block";
const headRow =
  "divide-x divide-slate-50 dark:divide-theme-border/50 bg-slate-300/70 dark:bg-theme-elevated *:px-4 *:py-2";
const bodyRow =
  "bg-slate-50/80 dark:bg-theme-card/30 hover:text-sky-600 dark:hover:text-sky-400 divide-x divide-y divide-slate-100 dark:divide-theme-border/40";
const cell = "whitespace-pre-wrap px-4 py-2";
const emptyBox =
  "bg-slate-50 dark:bg-theme-card rounded-lg p-8 text-center text-sm text-slate-500 dark:text-theme-fg-muted border border-slate-200 dark:border-theme-border border-dashed";
const cardClass =
  "w-full bg-white dark:bg-theme-card rounded-lg shadow-sm border border-slate-200 dark:border-theme-border p-3 flex flex-col gap-2";

export default function PenagihanBoard(props: {
  ownerUserId: number | null;
  mitras: Mitra[];
  initialPetugas: Petugas[];
}) {
  const [mitraId, setMitraId] = useState<number | null>(props.ownerUserId);
  const [petugas, setPetugas] = useState<Petugas[]>(props.initialPetugas);
  const readyMitraRef = useRef<number | null>(props.ownerUserId);
  const [nama, setNama] = useState("");
  const [komisiNominal, setKomisiNominal] = useState("0");
  const [nomor, setNomor] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cabutAkun, setCabutAkun] = useState(false);
  const [akunUser, setAkunUser] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rekapOpen, setRekapOpen] = useState(false);
  const [rekapPetugas, setRekapPetugas] = useState<{
    id: number;
    nama: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginPetugasUrl, setLoginPetugasUrl] = useState("/login/petugas");

  const queryMitra = mitraId ? `mitraId=${mitraId}` : "";
  const pageReady = Boolean(mitraId) || props.mitras.length === 0;

  const loadMaster = useCallback(async () => {
    if (!mitraId && props.mitras.length > 0) return;
    if (!queryMitra && props.ownerUserId == null) return;
    const silent = readyMitraRef.current === mitraId;
    if (!silent) setLoading(true);
    try {
      const [res, komisiRes] = await Promise.all([
        fetch(`/api/penagih?${queryMitra}`, { cache: "no-store" }),
        fetch(`/api/penagih/komisi${queryMitra ? `?${queryMitra}` : ""}`, { cache: "no-store" }),
      ]);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat petugas");
      const komisiJson = (await komisiRes.json().catch(() => null)) as {
        data?: { penagihId: number; saldo?: number; dibatalkan?: number }[];
      } | null;
      const komisiById = new Map(
        (komisiJson?.data ?? []).map((row) => [row.penagihId, row])
      );
      setPetugas(
        (json.penagih || []).map((row: Omit<Petugas, "komisiSaldo" | "komisiDibatalkan">) => {
          const komisi = komisiById.get(row.id);
          return {
            ...row,
            komisiSaldo: komisi?.saldo ?? 0,
            komisiDibatalkan: komisi?.dibatalkan ?? 0,
          };
        })
      );
      readyMitraRef.current = mitraId;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [mitraId, props.mitras.length, props.ownerUserId, queryMitra]);

  useEffect(() => {
    void loadMaster();
  }, [loadMaster]);

  useEffect(() => {
    setLoginPetugasUrl(`${window.location.origin}/login/petugas`);
  }, []);

  function openPetugasForm(row?: Petugas) {
    setEditId(row?.id ?? null);
    setNama(row?.nama ?? "");
    setKomisiNominal(String(row?.komisiNominal ?? 0));
    setNomor(row?.nomor ?? "");
    setUsername(row?.akunUser ?? "");
    setPassword("");
    setCabutAkun(false);
    setAkunUser(row?.akunUser ?? null);
    setFormOpen(true);
  }

  function closePetugasForm() {
    setFormOpen(false);
    setEditId(null);
    setNama("");
    setKomisiNominal("0");
    setNomor("");
    setUsername("");
    setPassword("");
    setCabutAkun(false);
    setAkunUser(null);
  }

  async function savePetugas() {
    const payload = {
      mitraId,
      nama,
      nomor,
      komisiNominal,
      username: cabutAkun ? undefined : username,
      password,
      cabutAkun,
    };
    const res = await fetch(editId ? `/api/penagih/${editId}` : "/api/penagih", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal menyimpan petugas");
      return;
    }
    closePetugasForm();
    toast.success(editId ? "Petugas diperbarui" : "Petugas ditambahkan");
    await loadMaster();
  }

  async function hapusPetugas(row: Petugas) {
    const ok = window.confirm(
      `Hapus petugas ${row.nama}? Pelanggan yang ditanganinya menjadi belum ditugaskan.`
    );
    if (!ok) return;
    const params = mitraId ? `?mitraId=${mitraId}` : "";
    const res = await fetch(`/api/penagih/${row.id}${params}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error || "Gagal menghapus petugas");
      return;
    }
    if (editId === row.id) closePetugasForm();
    toast.success("Petugas dihapus");
    await loadMaster();
  }

  async function toggleAktif(row: Petugas) {
    const res = await fetch(`/api/penagih/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mitraId, aktif: !row.aktif }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal mengubah status");
      return;
    }
    toast.success(row.aktif ? "Petugas dinonaktifkan" : "Petugas diaktifkan");
    await loadMaster();
  }

  return (
    <div className="space-y-6 w-full">
      <section className="flex flex-col md:grid md:grid-cols-3 gap-3 md:gap-4 w-full items-end md:items-center">
        <div className="hidden md:block" />
        <p className="flex justify-center font-medium items-center order-first md:order-none">
          Petugas
        </p>
        <div className="flex flex-wrap gap-2 justify-end items-center w-full md:justify-self-end">
          {props.mitras.length > 0 ? (
            <select
              aria-label="Mitra"
              className="h-8 max-w-48 rounded border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-card px-2 text-sm"
              value={mitraId ?? ""}
              onChange={(e) => {
                setMitraId(Number(e.target.value) || null);
              }}
            >
              <option value="">Pilih mitra</option>
              {props.mitras.map((mitra) => (
                <option key={mitra.id} value={mitra.id}>
                  {mitra.nama}
                </option>
              ))}
            </select>
          ) : null}
          <Link
            href={mitraId ? `/data-penagih?mitraId=${mitraId}` : "/data-penagih"}
            className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md bg-slate-200 px-2 text-xs font-medium text-sky-700 hover:bg-slate-300 dark:bg-theme-elevated dark:text-sky-400 dark:hover:bg-theme-muted"
          >
            Data Penagih
          </Link>
          {pageReady ? (
            <Button
              type="button"
              color="sky"
              className="text-xs py-1 px-2 gap-1 rounded-md font-medium whitespace-nowrap"
              onClick={() => openPetugasForm()}
            >
              <TbUserPlus className="size-3.5 shrink-0" />
              Tambah petugas
            </Button>
          ) : null}
        </div>
      </section>

      <p className="text-center text-sm text-slate-600 dark:text-theme-fg-muted">
        Login petugas:{" "}
        <a
          href={loginPetugasUrl}
          className="font-medium text-sky-800 dark:text-sky-400 underline underline-offset-2 break-all"
          target="_blank"
          rel="noopener noreferrer"
        >
          {loginPetugasUrl}
        </a>
      </p>

      {!pageReady ? (
        <div className={emptyBox}>Pilih mitra untuk menampilkan petugas.</div>
      ) : loading ? (
        <div className={emptyBox}>Memuat petugas...</div>
      ) : (
        <>
          <section className={tableWrap}>
            <table className="min-w-full">
              <thead>
                <tr className={headRow}>
                  <td>No.</td>
                  <td>Nama</td>
                  <td>No. HP</td>
                  <td>Pelanggan</td>
                  <td>Total komisi masuk</td>
                  <td>Status</td>
                  <td className="text-center">*</td>
                </tr>
              </thead>
              <tbody>
                {petugas.length === 0 ? (
                  <tr className="bg-slate-50/80 dark:bg-theme-card/30">
                    <td colSpan={7}>
                      <p className="px-4 py-6 text-center text-slate-500 dark:text-theme-fg-muted">
                        Belum ada petugas
                      </p>
                    </td>
                  </tr>
                ) : (
                  petugas.map((row, idx) => (
                    <tr key={row.id} className={bodyRow}>
                      <td className={cell}>{idx + 1}.</td>
                      <td className={cell}>
                        {row.nama}
                        <span className="block text-[11px] leading-snug text-slate-500">
                          {row.akunUser ? `Akun: ${row.akunUser}` : "Tanpa akun"}
                        </span>
                      </td>
                      <td className={cell}>{row.nomor || "—"}</td>
                      <td className={cell}>{row.jumlahPelanggan}</td>
                      <td className={cell}>{rp(row.komisiSaldo)}</td>
                      <td className={cell}>
                        <span
                          className={cn(
                            "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                            row.aktif
                              ? "bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300"
                              : "bg-slate-200 dark:bg-theme-muted text-slate-700 dark:text-theme-fg"
                          )}
                        >
                          {row.aktif ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className={cn(cell, "text-center")}>
                        <div className="inline-flex gap-1">
                          <Button
                            color="slatesky"
                            className="rounded p-2"
                            title="Rincian tunai dan transfer"
                            aria-label={`Rincian tunai dan transfer ${row.nama}`}
                            onClick={() => {
                              setRekapPetugas({ id: row.id, nama: row.nama });
                              setRekapOpen(true);
                            }}
                          >
                            <TbCalculator className="size-4" />
                          </Button>
                          <Button
                            color="slatesky"
                            className="rounded p-2"
                            title="Ubah"
                            onClick={() => openPetugasForm(row)}
                          >
                            <TbEdit className="size-4" />
                          </Button>
                          <Button
                            color="slatesky"
                            className="rounded p-2"
                            title={row.aktif ? "Nonaktifkan" : "Aktifkan"}
                            onClick={() => toggleAktif(row)}
                          >
                            {row.aktif ? (
                              <TbCircleOff className="size-4" />
                            ) : (
                              <TbCircleCheck className="size-4" />
                            )}
                          </Button>
                          <Button
                            color="slatesky"
                            className="rounded p-2"
                            title="Hapus"
                            onClick={() => hapusPetugas(row)}
                          >
                            <TbTrash className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="flex flex-col gap-3 md:hidden w-full">
            {petugas.length === 0 ? (
              <div className={emptyBox}>Belum ada petugas</div>
            ) : (
              petugas.map((row, idx) => (
                <div key={row.id} className={cardClass}>
                  <div className="flex justify-between items-start gap-2 border-b border-slate-100 dark:border-theme-border pb-2">
                    <div>
                      <p className="font-semibold text-sm">
                        {idx + 1}. {row.nama}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {row.akunUser ? `Akun: ${row.akunUser}` : "Tanpa akun"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-theme-fg-muted mt-0.5">
                        {row.nomor || "—"} · {row.jumlahPelanggan} pelanggan
                      </p>
                      <p className="text-xs text-slate-600 dark:text-theme-fg mt-1">
                        Total komisi masuk {rp(row.komisiSaldo)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                        row.aktif
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-200 text-slate-700"
                      )}
                    >
                      {row.aktif ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      color="slatesky"
                      className="rounded p-2"
                      title="Rincian tunai dan transfer"
                      aria-label={`Rincian tunai dan transfer ${row.nama}`}
                      onClick={() => {
                        setRekapPetugas({ id: row.id, nama: row.nama });
                        setRekapOpen(true);
                      }}
                    >
                      <TbCalculator className="size-4" />
                    </Button>
                    <Button
                      color="slatesky"
                      className="rounded p-2"
                      title="Ubah"
                      onClick={() => openPetugasForm(row)}
                    >
                      <TbEdit className="size-4" />
                    </Button>
                    <Button
                      color="slatesky"
                      className="rounded p-2"
                      title={row.aktif ? "Nonaktifkan" : "Aktifkan"}
                      onClick={() => toggleAktif(row)}
                    >
                      {row.aktif ? (
                        <TbCircleOff className="size-4" />
                      ) : (
                        <TbCircleCheck className="size-4" />
                      )}
                    </Button>
                    <Button
                      color="slatesky"
                      className="rounded p-2"
                      title="Hapus"
                      onClick={() => hapusPetugas(row)}
                    >
                      <TbTrash className="size-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}

      <DialogRekapMetode
        show={rekapOpen}
        setShow={setRekapOpen}
        mitraId={mitraId}
        penagih={rekapPetugas}
      />

      <Transition show={formOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[1001]" onClose={closePetugasForm}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </TransitionChild>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                    {editId ? "Ubah petugas" : "Tambah petugas"}
                  </DialogTitle>
                  <form
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void savePetugas();
                    }}
                  >
                    <Field>
                      <Label className="text-sm font-medium text-slate-700">
                        Nama <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        className="mt-1"
                        placeholder="Nama petugas"
                        value={nama}
                        required
                        onChange={(event) => setNama(event.target.value)}
                      />
                    </Field>
                    <Field>
                      <Label className="text-sm font-medium text-slate-700">
                        Komisi per bayar
                      </Label>
                      <Input
                        className="mt-1"
                        inputMode="numeric"
                        placeholder="0"
                        value={komisiNominal}
                        onChange={(event) => setKomisiNominal(event.target.value)}
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Setiap pencatatan bayar menambah komisi sebesar nominal ini. Isi 0 bila tanpa komisi.
                      </p>
                    </Field>
                    <Field>
                      <Label className="text-sm font-medium text-slate-700">No. HP</Label>
                      <Input
                        className="mt-1"
                        placeholder="No. HP"
                        value={nomor}
                        onChange={(event) => setNomor(event.target.value)}
                      />
                    </Field>
                    <Field>
                      <Label className="text-sm font-medium text-slate-700">
                        Username login
                      </Label>
                      <Input
                        className="mt-1"
                        placeholder="kosongkan jika hanya pakai kertas"
                        value={username}
                        autoComplete="off"
                        disabled={cabutAkun}
                        onChange={(event) => setUsername(event.target.value)}
                      />
                    </Field>
                    <Field>
                      <Label className="text-sm font-medium text-slate-700">
                        Password
                      </Label>
                      <Input
                        className="mt-1"
                        type="password"
                        placeholder={
                          akunUser
                            ? "kosongkan jika tidak diubah"
                            : "minimal 6 karakter"
                        }
                        value={password}
                        autoComplete="new-password"
                        disabled={cabutAkun}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                    </Field>
                    {akunUser ? (
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={cabutAkun}
                          onChange={(event) => setCabutAkun(event.target.checked)}
                        />
                        Cabut akun login
                      </label>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Isi username dan password bila petugas ini mencatat tagihan
                        langsung di aplikasi.
                      </p>
                    )}
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        type="button"
                        onClick={closePetugasForm}
                        className="bg-slate-200 text-slate-800 hover:bg-slate-300"
                      >
                        Batal
                      </Button>
                      <Button type="submit" className="bg-sky-600 text-white hover:bg-sky-700">
                        Simpan
                      </Button>
                    </div>
                  </form>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
