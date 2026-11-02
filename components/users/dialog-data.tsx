import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { SessionLucia } from "@/lib/auth";
import {
  normalizeStaffMenuWhitelist,
  reconcileStaffMenuKeys,
} from "@/lib/staff-menu-access";
import {
  STAFF_MENU_KEYS,
  STAFF_MENU_LABELS,
  type StaffMenuKey,
} from "@/lib/staff-menu-keys";
import { User, UserEdit, UserSchema, UserEditSchema } from "@/lib/user-types";
import { cn } from "@/lib/utils";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogPanel,
  DialogTitle,
  Field,
  Fieldset,
  Label,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { RoleName } from "@prisma/client";
import Fuse from "fuse.js";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { FaCheck, FaChevronDown } from "react-icons/fa6";
import { EditAction, EditState } from "./data";
import sendRegister from "@/lib/server-actions/wa/send-register";
import RegulatorySettingsFields, {
  defaultRegulatoryFormState,
  type RegulatoryFormState,
} from "./regulatory-settings-fields";
import {
  getOrCreateRegulatorySettings,
  saveRegulatorySettings,
} from "@/lib/server-actions/regulatory/actions";
import { validateRegulatoryPercents } from "@/lib/regulatory-calc";
import type { StaffPelangganOption } from "@/lib/staff-pelanggan-scope";

function defaultFreeCustomerQuotaFields(limit?: number | null) {
  return {
    freeCustomerQuotaMode:
      limit == null ? ("unlimited" as const) : ("limited" as const),
    freeCustomerLimit: limit ?? 10,
  };
}

function defaultPackageChangeQuotaFields(limit?: number | null) {
  return {
    pppPackageChangeQuotaMode:
      limit == null ? ("unlimited" as const) : ("limited" as const),
    pppPackageChangeLimit: limit ?? 1,
  };
}

type Props = {
  user: SessionLucia["user"];
  add: boolean;
  setAdd: React.Dispatch<React.SetStateAction<boolean>>;
  edit: EditState;
  editDispatch: React.Dispatch<EditAction>;
  parents: Pick<User, "id" | "nama">[];
};
export default function DialogData({
  add,
  setAdd,
  edit,
  editDispatch,
  user,
  parents,
}: Props) {
  const { refresh } = useRouter();
  const show = useMemo(() => {
    return add || edit.modal;
  }, [add, edit]);
  const close = () => {
    if (!add) {
      editDispatch({ action: "close" });
      // editDispatch({ action: "data", data: undefined });
      setTimeout(() => editDispatch({ action: "data", data: undefined }), 300);
    } else {
      setAdd(false);
    }
    setTimeout(() => {
      reset();
      setRegulatory(defaultRegulatoryFormState);
    }, 300);
    // refresh();
  };
  const val = useMemo(() => edit.data, [edit]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<UserEdit>({
    resolver: (data, context, options) => {
      return zodResolver(val?.id ? UserEditSchema : UserSchema)(
        data,
        context,
        options
      );
    },
    defaultValues: {
      nama: "",
      user: "",
      password: "",
      role: "Admin",
      parentId: null,
      omset: null,
      ppn: null,
      revenueBasis: "INVOICE",
      billingStartMode: "NEXT_MONTH",
      billingStartDate: undefined,
      billingGenerateDay: null,
      ...defaultFreeCustomerQuotaFields(),
      ...defaultPackageChangeQuotaFields(),
      staffMenuKeys: null,
      staffPelangganScope: null,
      staffAllowBankPayment: true,
      staffAllowIsolir: false,
      staffAllowCancelPayment: false,
      staffAllowBerhenti: false,
      pppAutoFillEnabled: false,
      portalPelangganEnabled: false,
      portalSlug: "",
      ownedByIsp: false,
      revenueShareEnabled: true,
    },
  });

  useEffect(() => {
    if (!show) return;

    if (!val?.id) {
      if (user?.role === "Superadmin") {
        reset({
          nama: "",
          user: "",
          password: "",
          role: "Admin",
          parentId: null,
          omset: null,
          ppn: null,
          revenueBasis: "INVOICE",
          billingStartMode: "NEXT_MONTH",
          billingStartDate: undefined,
          billingGenerateDay: null,
          ...defaultFreeCustomerQuotaFields(),
      ...defaultPackageChangeQuotaFields(),
          staffMenuKeys: null,
          staffPelangganScope: null,
          staffAllowBankPayment: true,
          staffAllowIsolir: false,
          staffAllowCancelPayment: false,
          staffAllowBerhenti: false,
          pppAutoFillEnabled: false,
          portalPelangganEnabled: false,
      portalSlug: "",
          ownedByIsp: false,
          revenueShareEnabled: true,
        });
        return;
      }
      reset({
        nama: "",
        user: "",
        password: "",
        role: "Keuangan",
        parentId: user?.id ?? null,
        omset: null,
        ppn: null,
        revenueBasis: "INVOICE",
        billingStartMode: "NEXT_MONTH",
        billingStartDate: undefined,
        billingGenerateDay: null,
        ...defaultFreeCustomerQuotaFields(),
      ...defaultPackageChangeQuotaFields(),
        staffMenuKeys: null,
        staffPelangganScope: null,
        staffAllowBankPayment: true,
        staffAllowIsolir: false,
        staffAllowCancelPayment: false,
        staffAllowBerhenti: false,
        pppAutoFillEnabled: false,
        portalPelangganEnabled: false,
      portalSlug: "",
        ownedByIsp: false,
        revenueShareEnabled: true,
      });
      return;
    }

    const rawBasis = (val as { revenueBasis?: string }).revenueBasis;
    const wl = normalizeStaffMenuWhitelist(
      (val as { staffMenuKeys?: unknown }).staffMenuKeys
    );
    const rawMode = (val as { billingStartMode?: string }).billingStartMode;
    const billingStartMode =
      rawMode === "IMMEDIATE" || rawMode === "CUSTOM_DATE"
        ? rawMode
        : "NEXT_MONTH";
    const bd = (val as { billingStartDate?: string | Date | null })
      .billingStartDate;

    reset({
      id: val.id,
      nama: val.nama,
      user: val.user,
      password: "",
      role: val.role,
      parentId: val.parentId,
      omset: val.omset,
      ppn: val.ppn,
      revenueBasis: rawBasis === "PAID" ? "PAID" : "INVOICE",
      billingStartMode,
      billingStartDate: bd
        ? typeof bd === "string"
          ? new Date(bd.slice(0, 10))
          : new Date(bd)
        : undefined,
      billingGenerateDay:
        (val as { billingGenerateDay?: number | null }).billingGenerateDay ??
        null,
      ...defaultFreeCustomerQuotaFields(
        (val as { freeCustomerLimit?: number | null }).freeCustomerLimit
      ),
      ...defaultPackageChangeQuotaFields(
        (val as { pppPackageChangeLimit?: number | null }).pppPackageChangeLimit
      ),
      staffMenuKeys: wl === null ? null : wl,
      staffPelangganScope: null,
      staffAllowBankPayment:
        (val as { staffAllowBankPayment?: boolean | null }).staffAllowBankPayment !==
        false,
      staffAllowIsolir:
        (val as { staffAllowIsolir?: boolean | null }).staffAllowIsolir === true,
      staffAllowCancelPayment:
        (val as { staffAllowCancelPayment?: boolean | null })
          .staffAllowCancelPayment === true,
      staffAllowBerhenti:
        (val as { staffAllowBerhenti?: boolean | null }).staffAllowBerhenti ===
        true,
      pppAutoFillEnabled:
        (val as { pppAutoFillEnabled?: boolean | null }).pppAutoFillEnabled ===
        true,
      portalPelangganEnabled:
        (val as { portalPelangganEnabled?: boolean | null })
          .portalPelangganEnabled === true,
      portalSlug:
        (val as { portalSlug?: string | null }).portalSlug ?? "",
      ownedByIsp:
        (val as { ownedByIsp?: boolean | null }).ownedByIsp === true,
      revenueShareEnabled:
        (val as { revenueShareEnabled?: boolean | null }).revenueShareEnabled !==
        false,
    });

    if (val.role === "Teknisi" || val.role === "Keuangan") {
      void fetch(`/api/user/${val.id}/staff-pelanggan-scope`)
        .then((r) => r.json())
        .then((j) => {
          const scope = j.data as number[] | null | undefined;
          setValue(
            "staffPelangganScope",
            scope == null ? null : scope
          );
        })
        .catch(() => setValue("staffPelangganScope", null));
    }
  }, [show, val, user, reset, setValue]);

  const [roles] = useState<RoleName[]>([
    "Superadmin",
    "Admin",
    "Keuangan",
    "Teknisi",
  ]);
  const [queryRole, setQueryRole] = useState<string>("");
  const [queryParent, setQueryParent] = useState<string>("");
  const [queryPelanggan, setQueryPelanggan] = useState<string>("");
  const [staffPelangganOptions, setStaffPelangganOptions] = useState<
    StaffPelangganOption[]
  >([]);

  const mitraIdForScope = watch("parentId") ?? user?.id ?? null;
  const staffRoleSelected =
    watch("role") === "Teknisi" || watch("role") === "Keuangan";

  useEffect(() => {
    if (!show || mitraIdForScope == null || !staffRoleSelected) {
      setStaffPelangganOptions([]);
      return;
    }
    void fetch(`/api/user/staff-pelanggan-options?mitraId=${mitraIdForScope}`)
      .then((r) => r.json())
      .then((j) =>
        setStaffPelangganOptions(Array.isArray(j.data) ? j.data : [])
      )
      .catch(() => setStaffPelangganOptions([]));
  }, [show, mitraIdForScope, staffRoleSelected]);

  const pelangganFuse = useMemo(
    () =>
      new Fuse(staffPelangganOptions, {
        keys: ["nama", "pppUsername", "routerNama"],
        threshold: 0.35,
      }),
    [staffPelangganOptions]
  );
  const filteredPelangganOptions = useMemo(() => {
    return queryPelanggan === ""
      ? staffPelangganOptions
      : pelangganFuse.search(queryPelanggan).map((v) => v.item);
  }, [staffPelangganOptions, queryPelanggan, pelangganFuse]);

  const filteredRoles = useMemo(() => {
    let availableRoles = roles;

    if (user?.role === "Admin") {
      availableRoles = roles.filter(
        (role) =>
          role === "Admin" || role === "Keuangan" || role === "Teknisi"
      );
    }
    return queryRole === ""
      ? availableRoles
      : availableRoles.filter((val) =>
          val.toLowerCase().includes(queryRole.toLowerCase())
        );
  }, [roles, queryRole, user]);

  const parentFuse = useMemo(
    () =>
      new Fuse(parents || [], {
        keys: ["nama"],
        threshold: 0.3,
      }),
    [parents]
  );
  const filteredParents = useMemo(() => {
    return queryParent === ""
      ? parents
      : parentFuse.search(queryParent).map((val) => val.item);
  }, [parents, queryParent, parentFuse]);

  const [mutating, setMutating] = useState<boolean>(false);
  const [regulatory, setRegulatory] = useState<RegulatoryFormState>(
    defaultRegulatoryFormState
  );

  const selectedParentId = watch("parentId");
  const rootMitraForm =
    user?.role === "Superadmin" &&
    watch("role") === "Admin" &&
    (val?.id ? val.parentId == null : selectedParentId == null);

  const showAdminRegulatory = rootMitraForm;

  useEffect(() => {
    if (!showAdminRegulatory || !val?.id) {
      setRegulatory(defaultRegulatoryFormState);
      return;
    }
    void getOrCreateRegulatorySettings(val.id).then((res) => {
      if (!("data" in res) || !res.data) return;
      setRegulatory({
        bhpEnabled: res.data.bhpEnabled,
        bhpPercent: res.data.bhpPercent,
        usoEnabled: res.data.usoEnabled,
        usoPercent: res.data.usoPercent,
      });
    });
  }, [showAdminRegulatory, val?.id]);

  const persistRegulatoryForMitra = async (mitraUserId: number) => {
    const percentError = validateRegulatoryPercents(
      regulatory.bhpPercent,
      regulatory.usoPercent
    );
    if (percentError) throw new Error(percentError);
    const regRes = await saveRegulatorySettings({
      mitraUserId,
      ...regulatory,
    });
    if ("error" in regRes && regRes.error) throw new Error(regRes.error);
  };

  const submitHandler: SubmitHandler<UserEdit> = async (data, e) => {
    e?.preventDefault();
    setMutating(true);
    try {
      const targetId = val?.id ?? (Number.isFinite(Number(data.id)) ? Number(data.id) : undefined);
      const mitraRole = data.role ?? val?.role;
      const isMitraAdmin = rootMitraForm;
      const revenueBasis: "INVOICE" | "PAID" =
        data.revenueBasis === "PAID" ? "PAID" : "INVOICE";
      const payload: Record<string, unknown> = {
        nama: data.nama,
        user: data.user,
        password: data.password,
        role: data.role,
        parentId: data.parentId,
        omset: data.omset,
        ppn: data.ppn,
        staffMenuKeys: data.staffMenuKeys,
        staffPelangganScope: data.staffPelangganScope,
      };

      if (data.role === "Teknisi" || data.role === "Keuangan") {
        payload.staffAllowBankPayment = data.staffAllowBankPayment !== false;
        payload.staffAllowIsolir = data.staffAllowIsolir === true;
        payload.staffAllowCancelPayment =
          data.staffAllowCancelPayment === true;
        payload.staffAllowBerhenti = data.staffAllowBerhenti === true;
      }

      if (user?.role === "Admin" && !val?.id) {
        payload.parentId = user.parentId ?? user.id;
      }

      if (isMitraAdmin) {
        payload.revenueBasis = revenueBasis;
        payload.billingStartMode = data.billingStartMode;
        payload.billingStartDate = data.billingStartDate;
        payload.billingGenerateDay =
          data.billingGenerateDay == null ||
          Number.isNaN(Number(data.billingGenerateDay))
            ? null
            : Number(data.billingGenerateDay);
        payload.freeCustomerLimit =
          data.freeCustomerQuotaMode === "limited"
            ? Math.max(
                0,
                Math.floor(Number(data.freeCustomerLimit) || 0)
              )
            : null;
        payload.pppPackageChangeLimit =
          data.pppPackageChangeQuotaMode === "limited"
            ? Math.max(0, Math.floor(Number(data.pppPackageChangeLimit) || 0))
            : null;
        payload.pppAutoFillEnabled = data.pppAutoFillEnabled === true;
        payload.ownedByIsp = data.ownedByIsp === true;
        payload.revenueShareEnabled =
          data.ownedByIsp === true ? data.revenueShareEnabled === true : true;
      }

      if (!val?.id) {
        const post = await fetch("/api/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resp = await post.json();
        if (resp.error) throw new Error(resp.error);
        if (!resp.data?.id) throw new Error("Gagal menyimpan data user");
        if (isMitraAdmin && !val?.id) {
          try {
            await persistRegulatoryForMitra(resp.data.id);
          } catch (regErr) {
            const msg = regErr instanceof Error ? regErr.message : String(regErr);
            toast.error(`User tersimpan, tetapi setting regulasi gagal: ${msg}`);
          }
        }
        toast.success(resp.message);
        void sendRegister(parseInt(data.nomor || "", 10)).catch(() => {});
      } else {
        if (targetId == null) throw new Error("ID user tidak valid");
        const put = await fetch(`/api/user/${targetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resp = await put.json();
        if (resp.error) throw new Error(resp.error);
        if (!resp.data?.id) throw new Error("Gagal mengupdate data user");
        if (isMitraAdmin) {
          try {
            await persistRegulatoryForMitra(resp.data.id);
          } catch (regErr) {
            const msg = regErr instanceof Error ? regErr.message : String(regErr);
            toast.error(`User diperbarui, tetapi setting regulasi gagal: ${msg}`);
          }
        }
        const savedBasis = resp.data?.revenueBasis as string | undefined;
        toast.success(
          resp.warning
            ? resp.message
            : savedBasis && isMitraAdmin
              ? `${resp.message} (${savedBasis === "PAID" ? "Pembayaran Masuk" : "Tagihan Terbit"})`
              : resp.message
        );
      }
      close();
      setTimeout(refresh, 500);
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
    } finally {
      setMutating(false);
    }
  };

  return (
    <Transition show={show} as={React.Fragment}>
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
                  className="flex sticky -top-6 z-50 bg-white justify-between items-center border-b border-slate-200 font-medium leading-6 text-gray-900"
                >
                  <p>User {val?.nama}</p>
                  <p className="text-base/7 text-center font-semibold">
                    Isi Data User
                  </p>
                </DialogTitle>
                <form
                  className="relative"
                  onSubmit={handleSubmit(submitHandler, (formErrors) => {
                    const first = Object.values(formErrors).find(
                      (err) => err && typeof err === "object" && "message" in err
                    ) as { message?: string } | undefined;
                    toast.error(
                      first?.message?.toString() ||
                        "Periksa form — ada field yang belum valid."
                    );
                  })}
                >
                  <Fieldset className="grid py-2">
                    <div className="grid gap-2.5">
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
                        <Input
                          {...register("nama")}
                          disabled={!!val?.id && user?.role !== "Superadmin"}
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.user && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              Username*
                            </Label>
                            {errors.user ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.user.message}
                              </p>
                            ) : null}
                          </div>
                          <Input {...register("user")} />
                        </Field>
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.password && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              Password*
                            </Label>
                            {errors.password ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.password.message}
                              </p>
                            ) : null}
                          </div>
                          <Input {...register("password")} />
                        </Field>
                      </div>
                      <Transition
                        as={React.Fragment}
                        show={user?.id !== val?.id}
                        enter="transition-opacity duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="transition-opacity duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                      >
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.role && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              Role*
                            </Label>
                            {errors.role ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.role.message}
                              </p>
                            ) : null}
                          </div>
                          <Controller
                            control={control}
                            name="role"
                            render={({
                              field: { onChange, value, disabled },
                            }) => (
                              <Combobox
                                value={roles.find((val) => val === value) || null}
                                onChange={(changeVal) => {
                                  onChange(changeVal || "");
                                  const r = changeVal || "";
                                  if (r !== "Teknisi" && r !== "Keuangan") {
                                    setValue("staffMenuKeys", null);
                                    setValue("staffPelangganScope", null);
                                    setValue("staffAllowBankPayment", true);
                                    setValue("staffAllowIsolir", false);
                                    setValue("staffAllowCancelPayment", false);
                                    setValue("staffAllowBerhenti", false);
                                  }
                                  if (r !== "Admin") {
                                    setValue("freeCustomerQuotaMode", "unlimited");
                                    setValue("freeCustomerLimit", 10);
                                    setValue("pppAutoFillEnabled", false);
                                    setValue("portalPelangganEnabled", false);
                                    setValue("portalSlug", "");
                                  }
                                }}
                                onClose={() => setQueryRole("")}
                                disabled={
                                  disabled ||
                                  (!!val?.id && user?.role !== "Superadmin")
                                }
                              >
                                <ComboboxButton className="relative">
                                  <ComboboxInput
                                    className={cn(
                                      "w-full rounded-lg border-none bg-slate-200/80 py-1.5 pr-8 pl-3 text-sm/6",
                                      "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25"
                                    )}
                                    displayValue={(
                                      displayValue: RoleName | null
                                    ) => displayValue || ""}
                                    onChange={(event) =>
                                      setQueryRole(event.target.value)
                                    }
                                  />
                                  <div className="group absolute top-1/2 -translate-y-1/2 right-0 px-2.5">
                                    <FaChevronDown className="size-4 fill-gray-900/60 group-data-[hover]:fill-gray-900" />
                                  </div>
                                </ComboboxButton>

                                <ComboboxOptions
                                  transition
                                  anchor="bottom"
                                  className={cn(
                                    "w-[var(--input-width)] rounded-xl border border-slate-300/80 bg-slate-200 p-1 [--anchor-gap:var(--spacing-1)] empty:invisible",
                                    "transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0"
                                  )}
                                >
                                  {filteredRoles.map((role) => (
                                    <ComboboxOption
                                      key={role}
                                      value={role}
                                      className="group flex justify-between cursor-pointer items-center gap-2 rounded-lg py-1.5 px-3 select-none data-[hover]:bg-slate-200/30 data-[active]:bg-slate-100"
                                    >
                                      <div>
                                        <p className="text-sm text-gray-900">
                                          {role}
                                        </p>
                                      </div>
                                      <FaCheck className="invisible size-4 fill-green-600 group-data-[selected]:visible" />
                                    </ComboboxOption>
                                  ))}
                                </ComboboxOptions>
                              </Combobox>
                            )}
                          />
                        </Field>
                      </Transition>
                      <Transition
                        as={React.Fragment}
                        show={
                          (user?.role === "Admin" ||
                            user?.role === "Superadmin") &&
                          (watch("role") === "Teknisi" ||
                            watch("role") === "Keuangan")
                        }
                        enter="transition-opacity duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="transition-opacity duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                      >
                        <Field className="grid gap-2 rounded-lg border border-slate-200 p-3 bg-slate-50/80">
                          <Label className="text-sm font-medium text-slate-800">
                            Akses menu (Teknisi / Keuangan)
                          </Label>
                          <p className="text-xs text-slate-500">
                            Kosongkan pembatasan untuk akses penuh seperti biasa.
                            Centang &quot;Batasi&quot; lalu pilih menu yang boleh
                            dibuka. PPPoE membutuhkan izin Router.
                          </p>
                          <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={Array.isArray(watch("staffMenuKeys"))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setValue("staffMenuKeys", []);
                                } else {
                                  setValue("staffMenuKeys", null);
                                }
                              }}
                            />
                            <span>Batasi menu yang bisa dibuka</span>
                          </label>
                          {Array.isArray(watch("staffMenuKeys")) ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {STAFF_MENU_KEYS.map((key: StaffMenuKey) => {
                                const selected = watch("staffMenuKeys") ?? [];
                                const on = selected.includes(key);
                                const routersOn = selected.includes("routers");
                                const pppoeDisabled =
                                  key === "pppoe" && !routersOn && !on;
                                return (
                                  <label
                                    key={key}
                                    className={cn(
                                      "flex items-center gap-2 text-sm",
                                      pppoeDisabled
                                        ? "cursor-not-allowed opacity-50"
                                        : "cursor-pointer"
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      className="rounded border-slate-300"
                                      checked={on}
                                      disabled={pppoeDisabled}
                                      onChange={() => {
                                        const cur = [
                                          ...(watch("staffMenuKeys") ?? []),
                                        ];
                                        let next: StaffMenuKey[];
                                        if (on) {
                                          next = cur.filter((k) => k !== key);
                                          if (key === "routers") {
                                            next = next.filter((k) => k !== "pppoe");
                                          }
                                        } else if (
                                          key === "pppoe" &&
                                          !cur.includes("routers")
                                        ) {
                                          next = reconcileStaffMenuKeys([
                                            ...cur,
                                            "routers",
                                            "pppoe",
                                          ]);
                                        } else {
                                          next = [...cur, key];
                                        }
                                        setValue(
                                          "staffMenuKeys",
                                          reconcileStaffMenuKeys(next)
                                        );
                                      }}
                                    />
                                    <span>{STAFF_MENU_LABELS[key]}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : null}
                          {errors.staffMenuKeys ? (
                            <p className="text-xs text-red-500">
                              {errors.staffMenuKeys.message as string}
                            </p>
                          ) : null}
                          <label className="flex items-center gap-2 cursor-pointer text-sm mt-1 pt-2 border-t border-slate-200">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={watch("staffAllowBankPayment") !== false}
                              onChange={(e) =>
                                setValue("staffAllowBankPayment", e.target.checked)
                              }
                            />
                            <span>Boleh catat pembayaran via transfer / bank</span>
                          </label>
                          <p className="text-xs text-slate-500 -mt-1">
                            Nonaktifkan jika staff hanya boleh mencatat pembayaran
                            tunai (Cash), tanpa pilih rekening bank.
                          </p>
                          <label className="flex items-center gap-2 cursor-pointer text-sm mt-1 pt-2 border-t border-slate-200">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={watch("staffAllowIsolir") === true}
                              onChange={(e) =>
                                setValue("staffAllowIsolir", e.target.checked)
                              }
                            />
                            <span>Boleh melakukan isolir PPP</span>
                          </label>
                          <p className="text-xs text-slate-500 -mt-1">
                            Aktifkan agar staff bisa isolir / buka isolir pelanggan
                            dari halaman pembayaran dan PPPoE.
                          </p>
                          <label className="flex items-center gap-2 cursor-pointer text-sm mt-1 pt-2 border-t border-slate-200">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={watch("staffAllowCancelPayment") === true}
                              onChange={(e) =>
                                setValue(
                                  "staffAllowCancelPayment",
                                  e.target.checked
                                )
                              }
                            />
                            <span>Boleh membatalkan pembayaran</span>
                          </label>
                          <p className="text-xs text-slate-500 -mt-1">
                            Aktifkan agar staff bisa mengembalikan tagihan Terbayar
                            ke Belum (satuan atau pilih banyak).
                          </p>
                          <label className="flex items-center gap-2 cursor-pointer text-sm mt-1 pt-2 border-t border-slate-200">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={watch("staffAllowBerhenti") === true}
                              onChange={(e) =>
                                setValue("staffAllowBerhenti", e.target.checked)
                              }
                            />
                            <span>
                              Boleh berhenti / aktifkan kembali langganan
                            </span>
                          </label>
                          <p className="text-xs text-slate-500 -mt-1">
                            Aktifkan agar staff bisa menandai pelanggan berhenti
                            atau mulai berlangganan lagi dari halaman pembayaran.
                          </p>
                        </Field>
                      </Transition>
                      <Transition
                        as={React.Fragment}
                        show={
                          (user?.role === "Admin" ||
                            user?.role === "Superadmin") &&
                          staffRoleSelected
                        }
                        enter="transition-opacity duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="transition-opacity duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                      >
                        <Field className="grid gap-2 rounded-lg border border-slate-200 p-3 bg-slate-50/80">
                          <Label className="text-sm font-medium text-slate-800">
                            Batas pelanggan PPP (pembayaran)
                          </Label>
                          <p className="text-xs text-slate-500">
                            Kosongkan pembatasan agar staff bisa mengelola semua
                            pelanggan mitra. Centang &quot;Batasi&quot; lalu pilih
                            pelanggan PPP yang boleh dikelola (misalnya 10 akun
                            untuk Keuangan A, sisanya untuk Keuangan B).
                          </p>
                          <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={Array.isArray(watch("staffPelangganScope"))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setValue("staffPelangganScope", []);
                                } else {
                                  setValue("staffPelangganScope", null);
                                }
                              }}
                            />
                            <span>Batasi pelanggan PPP yang bisa dikelola</span>
                          </label>
                          {Array.isArray(watch("staffPelangganScope")) ? (
                            <div className="grid gap-2">
                              <Input
                                type="search"
                                placeholder="Cari nama, PPP, atau router…"
                                value={queryPelanggan}
                                onChange={(e) =>
                                  setQueryPelanggan(e.target.value)
                                }
                                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                              />
                              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 grid gap-1">
                                {filteredPelangganOptions.length === 0 ? (
                                  <p className="text-xs text-slate-500 px-1 py-2">
                                    {staffPelangganOptions.length === 0
                                      ? "Belum ada pelanggan dengan PPP di mitra ini."
                                      : "Tidak ada hasil pencarian."}
                                  </p>
                                ) : (
                                  filteredPelangganOptions.map((p) => {
                                    const selected =
                                      watch("staffPelangganScope") ?? [];
                                    const on = selected.includes(p.id);
                                    return (
                                      <label
                                        key={p.id}
                                        className="flex items-start gap-2 cursor-pointer text-sm rounded px-1 py-0.5 hover:bg-slate-50"
                                      >
                                        <input
                                          type="checkbox"
                                          className="rounded border-slate-300 mt-0.5"
                                          checked={on}
                                          onChange={() => {
                                            const cur = [
                                              ...(watch("staffPelangganScope") ??
                                                []),
                                            ];
                                            if (on) {
                                              setValue(
                                                "staffPelangganScope",
                                                cur.filter((id) => id !== p.id)
                                              );
                                            } else {
                                              setValue("staffPelangganScope", [
                                                ...cur,
                                                p.id,
                                              ]);
                                            }
                                          }}
                                        />
                                        <span>
                                          <span className="font-medium">
                                            {p.pppUsername}
                                          </span>
                                          <span className="text-slate-500">
                                            {" "}
                                            — {p.nama} · {p.routerNama}
                                          </span>
                                        </span>
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                Terpilih:{" "}
                                {(watch("staffPelangganScope") ?? []).length}{" "}
                                pelanggan
                              </p>
                            </div>
                          ) : null}
                          {errors.staffPelangganScope ? (
                            <p className="text-xs text-red-500">
                              {errors.staffPelangganScope.message as string}
                            </p>
                          ) : null}
                        </Field>
                      </Transition>
                      <Transition
                        as="div"
                        className="space-y-2"
                        show={rootMitraForm}
                        enter="transition-opacity duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="transition-opacity duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                          <Field
                            className={cn(
                              "grid gap-1.5 rounded-lg min-w-0",
                              errors.omset && "bg-red-200"
                            )}
                          >
                            <div className="flex justify-between items-center gap-2">
                              <Label className="text-sm/6 font-medium">
                                Sharing Omset Mitra
                              </Label>
                              {errors.omset ? (
                                <p className="text-xs/5 text-red-500 shrink-0">
                                  {errors.omset.message}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex items-center divide-x divide-slate-300">
                              <Input
                                type="number"
                                step={1}
                                min={0}
                                max={100}
                                className="rounded-r-none flex-1 min-w-0"
                                placeholder="60"
                                {...register("omset", { valueAsNumber: true })}
                                disabled={
                                  watch("ownedByIsp") === true &&
                                  watch("revenueShareEnabled") === false
                                }
                              />
                              <div className="rounded-r-lg text-xs px-1.5 flex items-center h-full bg-slate-200 shrink-0">
                                %
                              </div>
                            </div>
                          </Field>
                          <Field
                            className={cn(
                              "grid gap-1.5 rounded-lg min-w-0",
                              errors.ppn && "bg-red-200"
                            )}
                          >
                            <div className="flex justify-between items-center gap-2">
                              <Label className="text-sm/6 font-medium">
                                PPN
                              </Label>
                              {errors.ppn ? (
                                <p className="text-xs/5 text-red-500 shrink-0">
                                  {errors.ppn.message}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex items-center divide-x divide-slate-300">
                              <Input
                                type="number"
                                step={0.1}
                                min={0}
                                max={100}
                                className="rounded-r-none flex-1 min-w-0"
                                {...register("ppn", { valueAsNumber: true })}
                              />
                              <div className="rounded-r-lg text-xs px-1.5 flex items-center h-full bg-slate-200 shrink-0">
                                %
                              </div>
                            </div>
                          </Field>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-theme-fg-muted leading-snug rounded-lg border border-slate-200 dark:border-theme-border bg-slate-50/80 dark:bg-theme-muted/30 px-2.5 py-2">
                          <span className="font-medium text-slate-700 dark:text-theme-fg">
                            Sharing Omset Mitra:
                          </span>{" "}
                          persentase bagian mitra dari pendapatan bersih (setelah
                          PPN, BHP, dan USO). Sisanya masuk Kantor ISP (mitra +
                          kantor = 100%). Kosongkan untuk default 50/50.
                        </p>
                        <Field className="grid gap-1.5 rounded-lg">
                          <Label className="text-sm/6 font-medium">
                            Kepemilikan ISP
                          </Label>
                          <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={watch("ownedByIsp") === true}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setValue("ownedByIsp", checked);
                                if (!checked) setValue("revenueShareEnabled", true);
                              }}
                            />
                            <span>User ini milik ISP</span>
                          </label>
                          <p className="text-xs text-slate-500 dark:text-theme-fg-muted">
                            Centang jika akun ini bagian dari ISP, bukan mitra
                            independen. Bagi hasil bisa dimatikan.
                          </p>
                          {watch("ownedByIsp") === true ? (
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                className="rounded border-slate-300"
                                checked={watch("revenueShareEnabled") !== false}
                                onChange={(e) =>
                                  setValue("revenueShareEnabled", e.target.checked)
                                }
                              />
                              <span>Bagi hasil aktif</span>
                            </label>
                          ) : null}
                          {watch("ownedByIsp") === true &&
                          watch("revenueShareEnabled") === false ? (
                            <p className="text-xs text-slate-500 dark:text-theme-fg-muted">
                              Bagi hasil dimatikan. Bagian kantor dari pendapatan
                              bersih menjadi 0. PPN, BHP, dan USO tetap dihitung.
                            </p>
                          ) : null}
                        </Field>
                        <Field className="grid gap-1.5 rounded-lg">
                          <Label className="text-sm/6 font-medium">
                            Metode Bagi Hasil
                          </Label>
                          <select
                            className="rounded-lg border-none py-2 px-3 text-sm bg-slate-200/80 dark:bg-theme-elevated dark:text-theme-fg w-full"
                            {...register("revenueBasis")}
                            disabled={
                              watch("ownedByIsp") === true &&
                              watch("revenueShareEnabled") === false
                            }
                          >
                                <option value="INVOICE">
                                  Berdasarkan Tagihan Terbit
                                </option>
                            <option value="PAID">
                              Berdasarkan Pembayaran Masuk
                            </option>
                          </select>
                          <p className="text-xs text-slate-500 dark:text-theme-fg-muted">
                            Tagihan Terbit: bagi hasil dihitung saat tagihan
                            dibuat. Pembayaran Masuk: bagi hasil baru dihitung
                            setelah pelanggan bayar.
                          </p>
                        </Field>
                        <Field className="grid gap-1.5 rounded-lg">
                          <Label className="text-sm/6 font-medium">
                            Tanggal Generate Tagihan (Mitra)
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            max={28}
                            placeholder="Kosong = pakai global"
                            {...register("billingGenerateDay", {
                              setValueAs: (v) =>
                                v === "" || v == null ? null : Number(v),
                            })}
                          />
                          <p className="text-xs text-slate-500 dark:text-theme-fg-muted">
                            1–28. Kosongkan untuk mengikuti pengaturan global
                            (Pengaturan → Billing).
                          </p>
                        </Field>
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.freeCustomerLimit && "bg-red-200"
                          )}
                        >
                          <Label className="text-sm/6 font-medium">
                            Kuota Pelanggan Gratis
                          </Label>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                value="unlimited"
                                {...register("freeCustomerQuotaMode")}
                                className="rounded border-slate-300"
                              />
                              <span className="text-sm">Unlimited</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                value="limited"
                                {...register("freeCustomerQuotaMode")}
                                className="rounded border-slate-300"
                              />
                              <span className="text-sm">Batasi</span>
                            </label>
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs text-slate-500">
                              Maksimal pelanggan gratis
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              disabled={watch("freeCustomerQuotaMode") !== "limited"}
                              {...register("freeCustomerLimit", {
                                valueAsNumber: true,
                              })}
                            />
                          </div>
                          {errors.freeCustomerLimit ? (
                            <p className="text-xs text-red-500">
                              {errors.freeCustomerLimit.message}
                            </p>
                          ) : null}
                          <p className="text-xs text-slate-500 dark:text-theme-fg-muted">
                            Unlimited = tanpa batas. Batasi = jumlah maksimum
                            pelanggan gratis aktif. Nilai 0 = tidak boleh
                            pelanggan gratis.
                          </p>
                        </Field>
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.pppPackageChangeLimit && "bg-red-200"
                          )}
                        >
                          <Label className="text-sm/6 font-medium">
                            Batas Upgrade / Downgrade per bulan
                          </Label>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                value="unlimited"
                                {...register("pppPackageChangeQuotaMode")}
                                className="rounded border-slate-300"
                              />
                              <span className="text-sm">Tidak dibatasi</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                value="limited"
                                {...register("pppPackageChangeQuotaMode")}
                                className="rounded border-slate-300"
                              />
                              <span className="text-sm">Batasi</span>
                            </label>
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs text-slate-500">
                              Maksimal kali dalam satu bulan
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              disabled={watch("pppPackageChangeQuotaMode") !== "limited"}
                              {...register("pppPackageChangeLimit", {
                                valueAsNumber: true,
                              })}
                            />
                          </div>
                          {errors.pppPackageChangeLimit ? (
                            <p className="text-xs text-red-500">
                              {errors.pppPackageChangeLimit.message}
                            </p>
                          ) : null}
                          <p className="text-xs text-slate-500 dark:text-theme-fg-muted">
                            Angka ini berlaku terpisah. Batas 1 berarti upgrade
                            sekali dan downgrade sekali dalam bulan yang sama.
                            Nilai 0 mematikan keduanya. Hitungan kembali kosong
                            setiap bulan.
                          </p>
                        </Field>
                        <Field className="grid gap-1.5 rounded-lg">
                          <Label className="text-sm/6 font-medium">
                            Auto Isi Pelanggan dari PPP
                          </Label>
                          <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={watch("pppAutoFillEnabled") === true}
                              onChange={(e) =>
                                setValue("pppAutoFillEnabled", e.target.checked)
                              }
                            />
                            <span>Aktifkan Auto Isi harian</span>
                          </label>
                          <p className="text-xs text-slate-500 dark:text-theme-fg-muted">
                            Jika aktif, PPP yang belum dijadikan pelanggan secara
                            manual akan otomatis dibuat saat sinkronisasi harian.
                          </p>
                        </Field>
                        <RegulatorySettingsFields
                          value={regulatory}
                          onChange={setRegulatory}
                          disabled={mutating}
                        />
                      </Transition>
                      <Transition
                        as={React.Fragment}
                        show={rootMitraForm}
                        enter="transition-opacity duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="transition-opacity duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                      >
                        <Field className="grid gap-1.5 rounded-lg">
                          <Label className="text-sm/6 font-medium">
                            Mulai Penagihan (diterapkan ke user PPPoE mitra)
                          </Label>
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  value="NEXT_MONTH"
                                  {...register("billingStartMode")}
                                  className="rounded border-slate-300"
                                />
                                <span className="text-sm">Bulan Depan (default)</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  value="IMMEDIATE"
                                  {...register("billingStartMode")}
                                  className="rounded border-slate-300"
                                />
                                <span className="text-sm">Mulai Sekarang</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  value="CUSTOM_DATE"
                                  {...register("billingStartMode")}
                                  className="rounded border-slate-300"
                                />
                                <span className="text-sm">Tanggal Khusus</span>
                              </label>
                            </div>
                            {watch("billingStartMode") === "CUSTOM_DATE" && (
                              <Controller
                                control={control}
                                name="billingStartDate"
                                render={({ field: { onChange, value } }) => (
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs text-slate-500 shrink-0">
                                      Bulan pertama tagihan:
                                    </Label>
                                    <Input
                                      type="date"
                                      value={
                                        value instanceof Date
                                          ? value.toISOString().slice(0, 10)
                                          : ""
                                      }
                                      onChange={(e) => {
                                        const v = e.target.value || undefined;
                                        onChange(v ? new Date(v) : undefined);
                                      }}
                                      className="max-w-[10rem] rounded-lg border border-slate-300 px-2 py-1"
                                    />
                                  </div>
                                )}
                              />
                            )}
                          </div>
                        </Field>
                      </Transition>
                      <Transition
                        as={React.Fragment}
                        show={
                          user?.role === "Superadmin" &&
                          (watch("role") === "Keuangan" ||
                            watch("role") === "Teknisi" ||
                            (watch("role") === "Admin" && !val?.id))
                        }
                        enter="transition-opacity duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="transition-opacity duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                      >
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.parentId && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              {watch("role") === "Admin"
                                ? "Mitra induk"
                                : "Parent*"}
                            </Label>
                            {watch("role") === "Admin" &&
                            watch("parentId") != null ? (
                              <button
                                type="button"
                                className="text-xs text-sky-700"
                                onClick={() => setValue("parentId", null)}
                              >
                                Kosongkan
                              </button>
                            ) : null}
                            {errors.parentId ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.parentId.message}
                              </p>
                            ) : null}
                          </div>
                          {watch("role") === "Admin" ? (
                            <p className="text-xs text-slate-500">
                              Kosongkan untuk mitra baru. Pilih mitra induk bila
                              Admin ini berada di dalam mitra yang sudah ada.
                            </p>
                          ) : null}
                          <Controller
                            control={control}
                            name="parentId"
                            render={({
                              field: { onChange, value, disabled },
                            }) => (
                              <Combobox
                                value={parents.find((val) => val.id === value) || null}
                                onChange={(changeVal) =>
                                  onChange(changeVal ? changeVal.id : null)
                                }
                                onClose={() => setQueryParent("")}
                                disabled={disabled}
                              >
                                <ComboboxButton className="relative">
                                  <ComboboxInput
                                    className={cn(
                                      "w-full rounded-lg border-none bg-slate-200/80 py-1.5 pr-8 pl-3 text-sm/6",
                                      "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25"
                                    )}
                                    displayValue={(
                                      displayValue: Pick<
                                        User,
                                        "id" | "nama"
                                      > | null
                                    ) => displayValue?.nama || ""}
                                    onChange={(event) =>
                                      setQueryParent(event.target.value)
                                    }
                                  />
                                  <div className="group absolute top-1/2 -translate-y-1/2 right-0 px-2.5">
                                    <FaChevronDown className="size-4 fill-gray-900/60 group-data-[hover]:fill-gray-900" />
                                  </div>
                                </ComboboxButton>

                                <ComboboxOptions
                                  transition
                                  anchor="bottom"
                                  className={cn(
                                    "w-[var(--input-width)] rounded-xl border border-slate-300/80 bg-slate-200 p-1 [--anchor-gap:var(--spacing-1)] empty:invisible",
                                    "transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0"
                                  )}
                                >
                                  {filteredParents.map((parent) => (
                                    <ComboboxOption
                                      key={parent.id}
                                      value={parent}
                                      className="group flex justify-between cursor-pointer items-center gap-2 rounded-lg py-1.5 px-3 select-none data-[hover]:bg-slate-200/30 data-[active]:bg-slate-100"
                                    >
                                      <div>
                                        <p className="text-sm text-gray-900">
                                          {parent.nama}
                                        </p>
                                      </div>
                                      <FaCheck className="invisible size-4 fill-green-600 group-data-[selected]:visible" />
                                    </ComboboxOption>
                                  ))}
                                </ComboboxOptions>
                              </Combobox>
                            )}
                          />
                        </Field>
                      </Transition>
                    </div>
                  </Fieldset>
                  <div className="sticky -bottom-4 mt-4 border-t gap-1 bg-white border-slate-200 py-2 flex">
                    <Button type="submit" loading={mutating}>
                      Simpan
                    </Button>
                    <Button color="red100" onClick={close}>
                      Tutup
                    </Button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
