import { Button } from "@/components/button";
import { Input, InputDate, InputIDR } from "@/components/input";
import { getErrorMessage, throwIfPelangganApiFailed } from "@/lib/get-error-message";
import { pelangganUpdateBodyFromForm } from "@/lib/pelanggan-update-schema";
import { EditAction, EditState } from "@/lib/ppp-types";
import { nominalPaketForDisplay, ppnFromPaketNominal } from "@/lib/paket-persist";
import { revalidatePPP } from "@/lib/server-actions/router/ppp/actions";
import { canAccessPenagihan } from "@/lib/penagih-rules";
import type { StaffAssignmentOption } from "@/lib/staff-pelanggan-scope";
import { cn, coorMalangArr } from "@/lib/utils";
import {
  PelangganOptionalDefaultsSchema,
} from "@/prisma/generated/zod";
import { Dialog, DialogPanel, DialogTitle, Field, Fieldset, Label, Select, Textarea, Transition, TransitionChild } from "@headlessui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Paket, Router, RoleName } from "@prisma/client";
import { useRouter } from "next/navigation";
import React, { cache, useEffect, useMemo, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TbChevronDown } from "react-icons/tb";
import dynamic from "next/dynamic";
import { z } from "zod";
import DialogResume from "./dialog-resume";
const Maps = cache(dynamic(() => import("@/components/maps"), { ssr: false }));

/** noLayanan diisi server (create) / diabaikan API (update) — jangan wajibkan di form. */
const PelangganFormSchema = PelangganOptionalDefaultsSchema.omit({
  noLayanan: true,
  autoFilledAt: true,
}).extend({
  noLayanan: z.string().optional(),
  autoFilledAt: z.coerce.date().nullish(),
  nik: z.string().max(20, "NIK maksimal 20 karakter").nullish(),
});
type PelangganFormValues = z.infer<typeof PelangganFormSchema>;

type Props = {
  edit: EditState;
  editDispatch: React.Dispatch<EditAction>;
  router: Pick<Router, "id" | "lat" | "lng"> | undefined;
  role: RoleName;
  pakets: Paket[];
  ppn: number | null | undefined;
  mitraUserId: number | null | undefined;
  createOpen?: boolean;
  onCloseCreate?: () => void;
  profiles?: string[];
};
export default function DialogEdit({
  edit,
  editDispatch,
  router,
  role,
  pakets,
  ppn,
  mitraUserId,
  createOpen = false,
  onCloseCreate,
  profiles = [],
}: Props) {
  const { refresh } = useRouter();
  const [secretName, setSecretName] = useState("");
  const [secretPassword, setSecretPassword] = useState("");
  const [secretProfile, setSecretProfile] = useState("");
  const close = () => {
    if (createOpen) {
      onCloseCreate?.();
      setSecretName("");
      setSecretPassword("");
      setSecretProfile("");
      setTimeout(reset, 300);
      return;
    }
    editDispatch({ action: "close" });
    setTimeout(reset, 300);
    setTimeout(() => editDispatch({ action: "data", data: undefined }), 300);
  };
  const val = useMemo(() => edit.data, [edit]);
  const ppnPct = ppn ?? 11;

  const [resumeDialog, setResumeDialog] = useState<boolean>(false);
  const [staffAssignment, setStaffAssignment] = useState<StaffAssignmentOption[]>(
    []
  );
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [penagihOptions, setPenagihOptions] = useState<
    { id: number; nama: string; aktif: boolean }[]
  >([]);
  const [selectedPenagihId, setSelectedPenagihId] = useState<number | "">("");
  const [initialPenagihId, setInitialPenagihId] = useState<number | null>(null);
  const [loadingPenagih, setLoadingPenagih] = useState(false);

  const canAssignStaff = role === "Admin" || role === "Superadmin";
  const canAssignPenagih = canAccessPenagihan(role);
  const pelangganId = val?.pelanggan?.id;

  const formOpen = edit.modal || createOpen;

  useEffect(() => {
    if (!formOpen || !canAssignStaff || !mitraUserId) {
      setStaffAssignment([]);
      setSelectedStaffIds([]);
      return;
    }

    if (pelangganId) {
      setLoadingStaff(true);
      void fetch(`/api/pelanggan/${pelangganId}/staff-assignment`)
        .then((r) => r.json())
        .then((j) => {
          const rows = Array.isArray(j.data)
            ? (j.data as StaffAssignmentOption[])
            : [];
          setStaffAssignment(rows);
          setSelectedStaffIds(rows.filter((s) => s.assigned).map((s) => s.id));
        })
        .catch(() => {
          setStaffAssignment([]);
          setSelectedStaffIds([]);
        })
        .finally(() => setLoadingStaff(false));
      return;
    }

    setLoadingStaff(true);
    void fetch(`/api/user/staff-under-mitra?mitraId=${mitraUserId}`)
      .then((r) => r.json())
      .then((j) => {
        const rows = Array.isArray(j.data)
          ? (j.data as StaffAssignmentOption[])
          : [];
        setStaffAssignment(rows);
        setSelectedStaffIds([]);
      })
      .catch(() => {
        setStaffAssignment([]);
        setSelectedStaffIds([]);
      })
      .finally(() => setLoadingStaff(false));
  }, [formOpen, edit.modal, canAssignStaff, pelangganId, mitraUserId]);

  useEffect(() => {
    if (!formOpen || !canAssignPenagih || !mitraUserId) {
      setPenagihOptions([]);
      setSelectedPenagihId("");
      setInitialPenagihId(null);
      return;
    }
    const currentId = val?.pelanggan?.penagihId ?? null;
    setSelectedPenagihId(currentId ?? "");
    setInitialPenagihId(currentId);
    setLoadingPenagih(true);
    void fetch(`/api/penagih?mitraId=${mitraUserId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const rows = Array.isArray(j.penagih)
          ? (j.penagih as { id: number; nama: string; aktif: boolean }[])
          : [];
        setPenagihOptions(rows);
      })
      .catch(() => setPenagihOptions([]))
      .finally(() => setLoadingPenagih(false));
  }, [
    formOpen,
    canAssignPenagih,
    mitraUserId,
    val?.pelanggan?.id,
    val?.pelanggan?.penagihId,
  ]);

  const toggleStaffAssignment = (staff: StaffAssignmentOption) => {
    if (staff.unrestricted) {
      setSelectedStaffIds((prev) =>
        prev.includes(staff.id) ? prev : [...prev, staff.id]
      );
      setStaffAssignment((prev) =>
        prev.map((s) =>
          s.id === staff.id ? { ...s, unrestricted: false, assigned: true } : s
        )
      );
      return;
    }
    setSelectedStaffIds((prev) =>
      prev.includes(staff.id)
        ? prev.filter((id) => id !== staff.id)
        : [...prev, staff.id]
    );
  };

  const persistStaffAssignment = async (savedPelangganId: number) => {
    if (!canAssignStaff) return;
    const put = await fetch(
      `/api/pelanggan/${savedPelangganId}/staff-assignment`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffUserIds: selectedStaffIds }),
      }
    );
    const resp = await put.json();
    if (resp.error) {
      throw new Error(getErrorMessage(resp, "Gagal menyimpan penugasan staff"));
    }
  };

  const persistPenagihAssignment = async (savedPelangganId: number) => {
    if (!canAssignPenagih || !mitraUserId) return;
    const nextId = selectedPenagihId === "" ? null : Number(selectedPenagihId);
    const prevId = initialPenagihId;
    if (nextId === prevId) return;
    if (nextId == null) {
      const res = await fetch("/api/penagih/penugasan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mitraId: mitraUserId,
          hapus: true,
          pelangganIds: [savedPelangganId],
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getErrorMessage(json, "Gagal menghapus petugas"));
      }
      return;
    }
    const res = await fetch("/api/penagih/penugasan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mitraId: mitraUserId,
        penagihId: nextId,
        pelangganIds: [savedPelangganId],
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(getErrorMessage(json, "Gagal menyimpan petugas"));
    }
  };

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<PelangganFormValues>({
    resolver: zodResolver(PelangganFormSchema),
  });

  useEffect(() => {
    if (createOpen) return;
    setValue("ppp_secretId", val?.id);
    if (router?.id) {
      setValue("routerId", router.id);
    }

    // Set default tanggal ke tanggal 1 bulan ini
    if (val?.created) {
      setValue("tgl", new Date(val.created).toLocaleDateString("fr-CA"));
    } else {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setValue("tgl", firstDay.toLocaleDateString("fr-CA"));
    }

    if (!val?.pelanggan) {
      setValue("tgl_isolir", null);
      setValue("lat", null);
      setValue("lng", null);
      setValue("nik", "");
      return;
    }
    setValue("id", val.pelanggan.id);
    setValue("tgl", new Date(val.pelanggan.tgl).toLocaleDateString("fr-CA"));
    if (val.pelanggan.tgl_isolir != null) {
      setValue("tgl_isolir", val.pelanggan.tgl_isolir);
    } else {
      setValue("tgl_isolir", null);
    }
    setValue("nama", val.pelanggan.nama);
    setValue("nik", val.pelanggan.nik ?? "");
    setValue("alamat", val.pelanggan.alamat);
    setValue("nomor", val.pelanggan.nomor);
    setValue("stop", val.pelanggan.stop);
    setValue("email", val.pelanggan.email);
    setValue("paketId", val.pelanggan.paketId);
    setValue("lat", val.pelanggan.lat ?? null);
    setValue("lng", val.pelanggan.lng ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setValue from useForm
  }, [createOpen, edit, router?.id, setValue, val]);

  useEffect(() => {
    if (!createOpen || !router?.id) return;
    const today = new Date();
    reset({
      routerId: router.id,
      tgl: today.toLocaleDateString("fr-CA"),
      alamat: "",
      nama: "",
      nik: "",
      nomor: "",
      email: "",
      tgl_isolir: null,
      lat: null,
      lng: null,
      stop: false,
    });
    setSecretName("");
    setSecretPassword("");
    setSecretProfile("");
  }, [createOpen, reset, router?.id]);

  const paketId = watch("paketId");
  const selectedPaket = useMemo(
    () => pakets.find((p) => p.id === Number(paketId)),
    [pakets, paketId]
  );
  const tagihanPaket = useMemo(() => {
    if (!selectedPaket) return null;
    const nominal = nominalPaketForDisplay(selectedPaket, ppnPct);
    const harga = Math.round(Number(selectedPaket.harga));
    return {
      harga,
      ppn: ppnFromPaketNominal(nominal, harga),
      nominal,
    };
  }, [selectedPaket, ppnPct]);

  const [zoom, setZoom] = useState<number>(13);
  const initCenter = useMemo(() => {
    if (!router?.lat || !router?.lng) return coorMalangArr;
    setZoom(16);
    return [parseFloat(router.lng), parseFloat(router.lat)];
  }, [router]);

  const lng = watch("lng");
  const lat = watch("lat");
  const coordinates = useMemo(() => {
    if (!lng || !lat) return null;
    return [parseFloat(lng), parseFloat(lat)];
  }, [lng, lat]) as [number, number] | null;

  const onClickMap = (longlat: [number, number]) => {
    setValue("lng", longlat.at(0)?.toString() ?? "");
    setValue("lat", longlat.at(1)?.toString() ?? "");
  };

  const [mutating, setMutating] = useState<boolean>(false);
  const onInvalid = () => {
    toast.error("Lengkapi field wajib (Nama, Tanggal, No. Whatsapp, Paket).");
  };
  useEffect(() => {
    if (!createOpen || !selectedPaket) return;
    const namaPaket = selectedPaket.nama.trim();
    const match = profiles.find(
      (profile) => profile.trim().toLowerCase() === namaPaket.toLowerCase()
    );
    setSecretProfile(match ?? namaPaket);
  }, [createOpen, profiles, selectedPaket]);

  const profileOptions = useMemo(() => {
    const names = new Set(profiles.map((profile) => profile.trim()).filter(Boolean));
    if (secretProfile.trim()) names.add(secretProfile.trim());
    return [...names];
  }, [profiles, secretProfile]);

  const submitHandler: SubmitHandler<PelangganFormValues> = async (data, e) => {
    e?.preventDefault();
    setMutating(true);
    try {
      if (createOpen) {
        const name = secretName.trim();
        const profile = secretProfile.trim();
        if (!/^[a-zA-Z0-9_.@-]{3,50}$/.test(name)) {
          toast.error(
            "Secret minimal 3 karakter: huruf, angka, underscore, titik, strip, atau @."
          );
          return;
        }
        if (secretPassword.trim().length < 3) {
          toast.error("Password minimal 3 karakter.");
          return;
        }
        if (!profile) {
          toast.error("Pilih profil.");
          return;
        }
        let post: Response;
        try {
          post = await fetch(`/api/router/${router?.id}/ppp/pelanggan-baru`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...data,
              routerId: router?.id,
              secret: name,
              password: secretPassword,
              profile,
            }),
          });
        } catch {
          throw new Error(
            "Koneksi terputus saat menambah pelanggan. Cek API Mikrotik lalu coba lagi. Jika secret sudah ada di Mikrotik, sync PPPoE dulu."
          );
        }
        const resp = (await post.json().catch(() => ({}))) as {
          data?: { id?: number };
          message?: string;
          error?: string;
        };
        throwIfPelangganApiFailed(post, resp, "Gagal menyimpan");
        const createdId = resp.data!.id as number;
        if (canAssignStaff && selectedStaffIds.length > 0) {
          await persistStaffAssignment(createdId);
        }
        await persistPenagihAssignment(createdId);
        toast.success(
          getErrorMessage(resp.message, "Berhasil menambah pelanggan dan secret di Mikrotik")
        );
        await revalidatePPP();
        close();
        refresh();
        return;
      }
      if (!val?.pelanggan) {
        const post = await fetch("/api/router/ppp/pelanggan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const resp = (await post.json()) as {
          data?: { id?: number };
          message?: string;
        };
        throwIfPelangganApiFailed(post, resp, "Gagal menyimpan");
        const createdId = resp.data!.id as number;
        if (canAssignStaff && selectedStaffIds.length > 0) {
          await persistStaffAssignment(createdId);
        }
        await persistPenagihAssignment(createdId);
        toast.success(getErrorMessage(resp.message, "Berhasil menyimpan"));
      } else {
        const put = await fetch(
          `/api/router/ppp/pelanggan/${data.ppp_secretId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pelangganUpdateBodyFromForm(data)),
          }
        );
        const resp = (await put.json()) as {
          data?: { id?: number };
          message?: string;
        };
        throwIfPelangganApiFailed(put, resp, "Gagal mengubah");
        if (canAssignStaff && pelangganId) {
          await persistStaffAssignment(pelangganId);
        }
        if (pelangganId) {
          await persistPenagihAssignment(pelangganId);
        }
        toast.success(
          getErrorMessage(resp.message, "Berhasil mengubah data pelanggan")
        );
      }
      await revalidatePPP();
      close();
      refresh();
    } catch (err) {
      toast.error(
        getErrorMessage(err, "Gagal mengubah data pelanggan. Harap coba lagi!")
      );
      console.error(err);
    } finally {
      setMutating(false);
    }
  };

  return (
    <Transition show={edit.modal || createOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-[1001]" onClose={close}>
        <TransitionChild
          as={React.Fragment}
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
          <div className="flex h-dvh items-center justify-end overflow-hidden text-center">
            <TransitionChild
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-50"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 translate-x-5 scale-95"
            >
              <DialogPanel className="h-full w-full max-w-3xl transform overflow-y-auto rounded bg-white p-6 pb-4 text-left text-gray-900 align-middle shadow-xl transition-all">
                <DialogTitle
                  as="div"
                  className="flex sticky text-xs sm:text-base -top-6 z-50 bg-white justify-between items-center border-b border-slate-200 font-medium leading-6 text-gray-900"
                >
                  <p>{createOpen ? "Pelanggan baru" : `PPP ${val?.name ?? ""}`}</p>
                  <div className="flex flex-col items-center">
                    <p className="text-base/7 text-center font-semibold">
                      {createOpen ? "Tambah Pelanggan" : "Isi Data Pelanggan"}
                    </p>
                    {val?.created && (
                      <p className="text-[10px] text-slate-500 font-normal leading-none pb-1">
                        (Data diambil:{" "}
                        {new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "long",
                          timeStyle: "short",
                        }).format(new Date(val.created))}
                        )
                      </p>
                    )}
                  </div>
                  {createOpen ? (
                    <p className="text-sky-600">Baru</p>
                  ) : !val?.pelanggan ? (
                    <p className="text-yellow-600 dark:text-amber-300">Belum Terdaftar</p>
                  ) : val.pelanggan.stop ? (
                    <p className="text-red-600">Nonaktif</p>
                  ) : (
                    <p className="text-sky-600">Terdaftar</p>
                  )}
                </DialogTitle>
                <form
                  className="relative"
                  onSubmit={handleSubmit(submitHandler, onInvalid)}
                >
                  <Fieldset className="grid py-2">
                    <div className="grid gap-2.5">
                      {createOpen ? (
                        <>
                          <Field className="grid gap-1.5">
                            <Label className="text-sm/6 font-medium">Secret*</Label>
                            <Input
                              value={secretName}
                              autoComplete="off"
                              placeholder="nama_secret"
                              onChange={(e) => setSecretName(e.target.value)}
                            />
                            <p className="text-xs text-slate-500">
                              Nama user PPPoE di Mikrotik. Huruf, angka, titik, strip, underscore, atau @.
                            </p>
                          </Field>
                          <Field className="grid gap-1.5">
                            <Label className="text-sm/6 font-medium">Password*</Label>
                            <Input
                              type="password"
                              value={secretPassword}
                              autoComplete="new-password"
                              onChange={(e) => setSecretPassword(e.target.value)}
                            />
                          </Field>
                          <Field className="grid gap-1.5">
                            <Label className="text-sm/6 font-medium">Profil*</Label>
                            <div className="relative">
                              <Select
                                className={cn(
                                  "block w-full appearance-none rounded-lg border-none py-1.5 px-3 text-sm/6 bg-slate-200/80",
                                  "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25",
                                  "*:text-black"
                                )}
                                value={secretProfile}
                                onChange={(e) => setSecretProfile(e.target.value)}
                              >
                                <option value="">Pilih profil</option>
                                {profileOptions.map((profile) => (
                                  <option key={profile} value={profile}>
                                    {profile}
                                  </option>
                                ))}
                              </Select>
                              <TbChevronDown
                                className="group pointer-events-none absolute top-2.5 right-2.5 size-4 fill-white/60"
                                aria-hidden="true"
                              />
                            </div>
                            <p className="text-xs text-slate-500">
                              Profil mengikuti nama paket. Bisa diganti jika nama profil di Mikrotik berbeda.
                            </p>
                          </Field>
                        </>
                      ) : null}
                      <Field
                        className={cn(
                          "grid gap-1.5 rounded-lg",
                          errors.nama && "bg-red-200"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <Label className="text-sm/6 font-medium">Nama*</Label>
                          {errors.nama ? (
                            <p className="text-xs/5 text-red-500">
                              {errors.nama.message}
                            </p>
                          ) : null}
                        </div>
                        <Input {...register("nama")} />
                      </Field>
                      <Field
                        className={cn(
                          "grid gap-1.5 rounded-lg",
                          errors.nik && "bg-red-200"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <Label className="text-sm/6 font-medium">NIK</Label>
                          {errors.nik ? (
                            <p className="text-xs/5 text-red-500">
                              {errors.nik.message}
                            </p>
                          ) : null}
                        </div>
                        <Input
                          {...register("nik")}
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={20}
                          placeholder="Kosongkan jika tidak ada"
                        />
                      </Field>
                      <Field
                        className={cn(
                          "grid gap-1.5 rounded-lg",
                          errors.tgl && "bg-red-200"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <Label className="text-sm/6 font-medium">
                            Tanggal Berlangganan*
                          </Label>
                          {errors.tgl ? (
                            <p className="text-xs/5 text-red-500">
                              {errors.tgl.message}
                            </p>
                          ) : null}
                        </div>
                        <Controller
                          control={control}
                          name="tgl"
                          render={({ field: { onChange, value } }) => (
                            <InputDate
                              value={value as string}
                              onChange={onChange}
                              readOnly={role !== "Superadmin"}
                              className={cn(role !== "Superadmin" && "bg-slate-100 text-slate-500")}
                            />
                          )}
                        />
                      </Field>
                      <Field
                        className={cn(
                          "grid gap-1.5 rounded-lg",
                          errors.tgl_isolir && "bg-red-200"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <Label className="text-sm/6 font-medium">
                            Tanggal isolir (opsional)
                          </Label>
                          {errors.tgl_isolir ? (
                            <p className="text-xs/5 text-red-500">
                              {errors.tgl_isolir.message}
                            </p>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-theme-fg-muted -mt-1">
                          Hari bulan tagihan untuk auto isolir (1–30). Kosongkan jika hanya
                          isolir manual — pelanggan tanpa isian ini tidak ikut auto isolir.
                          Jika semua pelanggan tanggalnya sama, pakai tombol Tanggal isolir
                          semua di halaman PPP.
                        </p>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          placeholder="Kosongkan = tidak ikut auto isolir"
                          {...register("tgl_isolir", {
                            setValueAs: (v) => {
                              if (v === "" || v == null) return null;
                              const n = Number(v);
                              return Number.isFinite(n) ? n : null;
                            },
                          })}
                        />
                      </Field>
                      <Field
                        className={cn(
                          "grid gap-1.5 rounded-lg",
                          errors.alamat && "bg-red-200"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <Label className="text-sm/6 font-medium">
                            Alamat
                          </Label>
                          {errors.alamat ? (
                            <p className="text-xs/5 text-red-500">
                              {errors.alamat.message}
                            </p>
                          ) : null}
                        </div>
                        <Textarea
                          className={cn(
                            "block w-full resize-none rounded-lg border-none py-1.5 px-3 text-sm/6 bg-slate-200/80",
                            "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25"
                          )}
                          {...register("alamat")}
                        />
                      </Field>
                      <Field className="grid gap-1.5">
                        <Label className="text-sm/6 font-medium">Lokasi</Label>
                        <div className="flex gap-2 items-center">
                          <Input {...register("lat")} placeholder="Latitude" />
                          <p>-</p>
                          <Input {...register("lng")} placeholder="Longitude" />
                        </div>
                        <div className="flex h-64">
                          <Maps
                            zoom={zoom}
                            initCenter={initCenter}
                            onClickMap={onClickMap}
                            markerCoordinates={coordinates}
                          />
                        </div>
                      </Field>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.nomor && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              No. Whatsapp
                            </Label>
                            {errors.nomor ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.nomor.message}
                              </p>
                            ) : null}
                          </div>
                          <Input {...register("nomor")} />
                        </Field>
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.email && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              Email
                            </Label>
                            {errors.email ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.email.message}
                              </p>
                            ) : null}
                          </div>
                          <Input {...register("email")} />
                        </Field>
                      </div>
                      <Field
                        className={cn(
                          "grid gap-1.5 rounded-lg",
                          errors.paketId && "bg-red-200"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <Label className="text-sm/6 font-medium">
                            Paket*
                          </Label>
                          {errors.paketId ? (
                            <p className="text-xs/5 text-red-500">
                              {errors.paketId.message}
                            </p>
                          ) : null}
                        </div>
                        <Controller
                          control={control}
                          name="paketId"
                          render={({ field: { onChange, value, onBlur } }) => (
                            <div className="relative">
                              <Select
                                className={cn(
                                  "block w-full appearance-none rounded-lg border-none py-1.5 px-3 text-sm/6 bg-slate-200/80",
                                  "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25",
                                  // Make the text of each option black on Windows
                                  "*:text-black"
                                )}
                                value={value}
                                onChange={(val) =>
                                  onChange(parseInt(val.target.value, 10))
                                }
                                onBlur={onBlur}
                              >
                                {!!value ? null : (
                                  <option value={""}>Pilih Paket</option>
                                )}
                                {pakets.map((val) => (
                                  <option
                                    value={val.id}
                                    key={"pakets-" + val.id}
                                  >
                                    {val.nama + " - " + val.kapasitas + " Mb"}
                                  </option>
                                ))}
                              </Select>
                              <TbChevronDown
                                className="group pointer-events-none absolute top-2.5 right-2.5 size-4 fill-white/60"
                                aria-hidden="true"
                              />
                            </div>
                          )}
                        />
                      </Field>
                      <div className="grid grid-cols-3 gap-1.5">
                        <Field className="grid gap-1.5">
                          <Label className="text-sm/6 font-medium">
                            Harga Paket
                          </Label>
                          <InputIDR disabled value={tagihanPaket?.harga ?? ""} />
                        </Field>
                        <Field className="grid gap-1.5">
                          <Label className="text-sm/6 font-medium">PPN</Label>
                          <InputIDR disabled value={tagihanPaket?.ppn ?? ""} />
                        </Field>
                        <Field className="grid gap-1.5">
                          <Label className="text-sm/6 font-bold">
                            Nominal Pembayaran
                          </Label>
                          <InputIDR disabled value={tagihanPaket?.nominal ?? ""} />
                        </Field>
                      </div>
                      {canAssignPenagih ? (
                        <Field className="grid gap-1.5">
                          <Label className="text-sm/6 font-medium">Petugas</Label>
                          <div className="relative">
                            <Select
                              className={cn(
                                "block w-full appearance-none rounded-lg border-none py-1.5 px-3 text-sm/6 bg-slate-200/80",
                                "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25",
                                "*:text-black"
                              )}
                              value={selectedPenagihId === "" ? "" : String(selectedPenagihId)}
                              disabled={loadingPenagih}
                              onChange={(e) => {
                                const next = e.target.value;
                                setSelectedPenagihId(next === "" ? "" : Number(next));
                              }}
                            >
                              <option value="">Belum ditugaskan</option>
                              {penagihOptions.map((row) => (
                                <option
                                  key={row.id}
                                  value={row.id}
                                  disabled={!row.aktif && row.id !== initialPenagihId}
                                >
                                  {row.nama}
                                  {row.aktif ? "" : " (nonaktif)"}
                                </option>
                              ))}
                            </Select>
                            <TbChevronDown
                              className="group pointer-events-none absolute top-2.5 right-2.5 size-4 fill-white/60"
                              aria-hidden="true"
                            />
                          </div>
                          {loadingPenagih ? (
                            <p className="text-xs text-slate-500">Memuat petugas…</p>
                          ) : penagihOptions.length === 0 ? (
                            <p className="text-xs text-slate-500">
                              Belum ada petugas. Tambah di halaman Penagihan.
                            </p>
                          ) : null}
                        </Field>
                      ) : null}
                      {canAssignStaff ? (
                        <Field className="grid gap-2 rounded-lg border border-slate-200 p-3 bg-slate-50/80">
                          <Label className="text-sm font-medium text-slate-800">
                            Dikelola staff Keuangan / Teknisi
                          </Label>
                          <p className="text-xs text-slate-500">
                            Pilih staff yang boleh mengelola pembayaran PPP ini.
                            Staff berlabel &quot;Semua pelanggan&quot; belum dibatasi —
                            centang untuk mulai membatasi ke PPP ini (tambah PPP lain
                            lewat edit serupa atau menu Users).
                          </p>
                          {loadingStaff ? (
                            <p className="text-xs text-slate-500">Memuat daftar staff…</p>
                          ) : staffAssignment.length === 0 ? (
                            <p className="text-xs text-slate-500">
                              Belum ada staff Keuangan/Teknisi di mitra ini.
                            </p>
                          ) : (
                            <div className="grid gap-1.5 max-h-40 overflow-y-auto">
                              {staffAssignment.map((staff) => {
                                const checked = selectedStaffIds.includes(staff.id);
                                return (
                                  <label
                                    key={staff.id}
                                    className="flex items-start gap-2 cursor-pointer text-sm rounded px-1 py-0.5 hover:bg-white"
                                  >
                                    <input
                                      type="checkbox"
                                      className="rounded border-slate-300 mt-0.5"
                                      checked={checked}
                                      onChange={() => toggleStaffAssignment(staff)}
                                    />
                                    <span>
                                      <span className="font-medium">{staff.nama}</span>
                                      <span className="text-slate-500">
                                        {" "}
                                        (@{staff.user}) · {staff.role}
                                      </span>
                                      {staff.unrestricted ? (
                                        <span className="ml-1 text-xs text-amber-700">
                                          — Semua pelanggan
                                        </span>
                                      ) : null}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </Field>
                      ) : null}
                    </div>
                  </Fieldset>
                  <div className="sticky -bottom-4 mt-4 border-t gap-1 bg-white border-slate-200 py-2 flex">
                    <Button type="submit" loading={mutating}>
                      Simpan
                    </Button>
                    {val?.pelanggan && val.pelanggan.stop ? (
                      <Button color="sky" onClick={() => setResumeDialog(true)}>
                        Mulai Berlangganan
                      </Button>
                    ) : null}
                    <Button color="red100" onClick={close}>
                      Tutup
                    </Button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
        <DialogResume
          show={resumeDialog}
          setShow={setResumeDialog}
          closeParent={close}
          data={val}
        />
      </Dialog>
    </Transition>
  );
}
