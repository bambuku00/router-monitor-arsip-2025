import { Button } from "@/components/button";
import {
  Input,
  InputDropzoneFile,
  InputPhone,
  InputRadioCheckbox,
} from "@/components/input";
import { SessionLucia } from "@/lib/auth";
import { Client, ClientSchema } from "@/lib/user-types";
import { cn } from "@/lib/utils";
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogPanel,
  DialogTitle,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Field,
  Fieldset,
  Label,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Client as PrismaClient, ClientPerorangan, Identitas, Kodepos, Province, Regency } from "@prisma/client";
import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { FaCheck, FaChevronDown } from "react-icons/fa6";
import { EditAction, EditState } from "./data";
import { getWilayah } from "@/lib/server-actions/wilayah";

type Props = {
  user: SessionLucia["user"];
  add: boolean;
  setAdd: React.Dispatch<React.SetStateAction<boolean>>;
  edit: EditState;
  editDispatch: React.Dispatch<EditAction>;
};

type Wilayah = Kodepos & { regency: Regency & { province: Province } };
export default function DialogClient({
  add,
  setAdd,
  edit,
  editDispatch,
  user,
}: Props) {
  const { refresh } = useRouter();
  const show = useMemo(() => {
    return add || edit.modal;
  }, [add, edit]);
  const close = () => {
    if (!add) {
      editDispatch({ action: "close" });
      setTimeout(() => editDispatch({ action: "data", data: undefined }), 300);
    } else {
      setAdd(false);
    }
    setTimeout(reset, 300);
  };
  const val = useMemo(() => edit.data, [edit]);
  const restricted = useMemo(
    () => !!val?.id && user?.role !== "Superadmin",
    [val, user]
  );

  useEffect(() => {
    if (!add && !edit.modal) return;

    if (val) {
      setValue("id", val.id);
      setValue("nama", val.nama);
      setValue("user", val.user);
      setValue("alamat", val.alamat || "");
      setValue("nomor", val.nomor || "");

      if (val.identitas) {
        setValue("identitas.jenis", val.identitas);
        setValue("identitas.nomor", val.no_identitas || "");
      }
      if (val.npwp) {
        setValue("npwp.nomor", val.npwp);
      }

      if (val.client) {
        setValue("tgl", val.client.tgl);
        setValue("institusi", val.client.institusi);
        setValue("kota", val.client.kota);
        setValue("pos", val.client.pos);
        setValue("telepon", val.client.telepon || "");

        const pj = val.client.perorangan.find((p: ClientPerorangan) => p.orang === "PJ");
        if (pj) {
          setValue("pj.nama", pj.nama);
          setValue("pj.jabatan", pj.jabatan || "");
          setValue("pj.nomor", pj.nomor);
          setValue("pj.email", pj.email || "");
        }

        const teknisi = val.client.perorangan.find(
          (p: ClientPerorangan) => p.orang === "Teknisi"
        );
        if (teknisi) {
          setValue("teknisi.sama", false);
          setValue("teknisi.nama", teknisi.nama);
          setValue("teknisi.nomor", teknisi.nomor);
          setValue("teknisi.email", teknisi.email || "");
        } else {
          setValue("teknisi.sama", true);
        }

        const keuangan = val.client.perorangan.find(
          (p: ClientPerorangan) => p.orang === "Keuangan"
        );
        if (keuangan) {
          setValue("keuangan.sama", false);
          setValue("keuangan.nama", keuangan.nama);
          setValue("keuangan.nomor", keuangan.nomor);
          setValue("keuangan.email", keuangan.email || "");
        } else {
          setValue("keuangan.sama", true);
        }
      }
    } else {
      setValue("identitas.jenis", "NIK");
      setValue("keuangan.sama", false);
      setValue("teknisi.sama", false);
    }
    // setValue("id", val.id);
    // setValue("nama", val.nama);
    // setValue("user", val.user);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setValue from useForm declared below
  }, [add, edit]);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    watch,
    trigger,
    formState: { errors },
  } = useForm<Client>({
    resolver: zodResolver(ClientSchema),
  });
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      // form validation errors present
    }
  }, [errors]);
  // useEffect(() => {
  //   const subscription = watch((value, { name, type }) =>
  //     console.log(value, name, type)
  //   );
  //   return () => subscription.unsubscribe();
  // }, [watch]);
  const kodepos = watch("pos") || "";
  const deferredKodepos = useDeferredValue(kodepos);
  const [wilayah, setWilayah] = useState<Wilayah[]>([]);
  const loadWilayah = useCallback(async () => {
    try {
      const resp = await getWilayah(deferredKodepos);
      setWilayah(resp);
    } catch (err) {
      const error = err as Error;
      console.error(error);
    }
  }, [deferredKodepos]);

  useEffect(() => {
    loadWilayah();
  }, [loadWilayah]);

  const [mutating, setMutating] = useState<boolean>(false);
  const submitHandler: SubmitHandler<Client> = async (data, e) => {
    e?.preventDefault();
    setMutating(true);
    const formData = new FormData();
    (Object.keys(data) as (keyof Client)[]).forEach((key) => {
      const value = data[key];
      if (value instanceof File) {
        formData.append(key, value);
      } else if (typeof value === "object" && value !== null) {
        Object.keys(value).forEach((subKey) => {
          const subValue = (value as Record<string, unknown>)[subKey];
          if (subValue instanceof File) {
            formData.append(`${key}.${subKey}`, subValue);
          } else if (subValue !== null && subValue !== undefined) {
            formData.append(`${key}.${subKey}`, String(subValue));
          }
        });
      } else if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });
    try {
      if (!val?.id) {
        const post = await fetch("/api/user/client", {
          method: "POST",
          body: formData,
        });
        const resp = await post.json();
        if (resp.error) throw new Error(resp.error);
        if (!resp.data?.id) throw new Error("Gagal menyimpan data client");
        toast.success(resp.message);
      } else {
        const put = await fetch(`/api/user/client/${val?.id}`, {
          method: "PUT",
          body: formData,
        });
        const resp = await put.json();
        if (resp.error) throw new Error(resp.error);
        if (!resp.data?.id) throw new Error("Gagal mengupdate data client");
        toast.success(resp.message);
      }
      close();
      setTimeout(refresh, 500);
    } catch (err) {
      const error = err as Error;
      toast.error("Penyimpanan gagal");
      console.error(error.message);
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
                  <p>User Client {val?.nama}</p>
                  <p className="text-base/7 text-center font-semibold">
                    Isi Data User Client
                  </p>
                </DialogTitle>
                <form
                  className="relative"
                  onSubmit={handleSubmit(submitHandler)}
                >
                  <Fieldset className="grid grid-cols-2 gap-1.5 py-2">
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
                  </Fieldset>
                  <fieldset
                    className="grid grid-cols-2 gap-1.5 py-2"
                    disabled={restricted}
                  >
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
                    <Field
                      className={cn(
                        "grid gap-1.5 rounded-lg",
                        errors.tgl && "bg-red-200"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">
                          Tanggal Registrasi*
                        </Label>
                        {errors.tgl ? (
                          <p className="text-xs/5 text-red-500">
                            {errors.tgl.message}
                          </p>
                        ) : null}
                      </div>
                      <Input type="date" {...register("tgl")} disabled={restricted} />
                    </Field>
                    <Field
                      className={cn(
                        "grid gap-1.5 rounded-lg",
                        errors.institusi && "bg-red-200"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">
                          Jenis Usaha atau Institusi*
                        </Label>
                        {errors.institusi ? (
                          <p className="text-xs/5 text-red-500">
                            {errors.institusi.message}
                          </p>
                        ) : null}
                      </div>
                      <Input
                        {...register("institusi")}
                        disabled={restricted}
                      />
                    </Field>
                    <Field
                      className={cn(
                        "grid gap-1.5 rounded-lg",
                        errors.alamat && "bg-red-200"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">Alamat*</Label>
                        {errors.alamat ? (
                          <p className="text-xs/5 text-red-500">
                            {errors.alamat.message}
                          </p>
                        ) : null}
                      </div>
                      <Input {...register("alamat")} disabled={restricted} />
                    </Field>
                    <Field
                      className={cn(
                        "grid gap-1.5 rounded-lg",
                        errors.pos && "bg-red-200"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">
                          Kode Pos*
                        </Label>
                        {errors.pos ? (
                          <p className="text-xs/5 text-red-500">
                            {errors.pos.message}
                          </p>
                        ) : null}
                      </div>
                      <Controller
                        control={control}
                        name="pos"
                        render={({ field: { onChange, value, disabled } }) => (
                          <Combobox
                            as="div"
                            className="relative"
                            value={wilayah.find((val) => val.code === value)}
                            onChange={(changeVal) => {
                              onChange(changeVal?.code);
                              const value = wilayah.find(
                                (val) => val.code === changeVal?.code
                              );
                              setValue(
                                "kota",
                                value
                                  ? `${value?.regency.nama}, ${value?.regency.province.nama}`
                                  : ""
                              );
                            }}
                            disabled={disabled || restricted}
                          >
                            <ComboboxInput
                              className={cn(
                                "w-full rounded-lg border-none bg-slate-200/80 py-1.5 pr-8 pl-3 text-sm/6",
                                "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25"
                              )}
                              displayValue={(displayValue: Wilayah | null) =>
                                displayValue?.code || ""
                              }
                              onChange={(event) => onChange(event.target.value)}
                              placeholder="Kode Pos (Berdasarkan kota/provinsi)"
                            />
                            <div className="group absolute top-1/2 -translate-y-1/2 right-0 px-2.5">
                              <FaChevronDown className="size-4 text-gray-900/40" />
                            </div>

                            <ComboboxOptions
                              transition
                              anchor="bottom"
                              className={cn(
                                "w-[var(--input-width)] rounded-xl border border-slate-300/80 bg-slate-200 p-1 [--anchor-gap:var(--spacing-1)] empty:invisible",
                                "transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0"
                              )}
                            >
                              {wilayah.map((w) => (
                                <ComboboxOption
                                  key={w.code}
                                  value={w}
                                  className="group flex justify-between cursor-pointer items-center gap-2 rounded-lg py-1.5 px-3 select-none data-[hover]:bg-slate-200/30 data-[active]:bg-slate-100"
                                >
                                  <div>
                                    <p className="text-sm/6 text-gray-900">
                                      {w.code}
                                    </p>
                                    <p className="text-sm/7 text-gray-900">
                                      {`${w.regency.nama}, ${w.regency.province.nama}`}
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
                    <Field
                      className={cn(
                        "grid gap-1.5 rounded-lg",
                        errors.kota && "bg-red-200"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">
                          Kota/Provinsi*
                        </Label>
                        {errors.kota ? (
                          <p className="text-xs/5 text-red-500">
                            {errors.kota.message}
                          </p>
                        ) : null}
                      </div>
                      <Input {...register("kota")} disabled={restricted} />
                    </Field>
                    <Field
                      className={cn(
                        "flex flex-col gap-1.5 col-span-2 rounded-lg",
                        errors.npwp && "bg-red-200"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">NPWP</Label>
                        {errors.npwp ? (
                          <p className="text-xs/5 text-red-500">Invalid</p>
                        ) : null}
                      </div>
                      <Input {...register("npwp.nomor")} placeholder="NPWP" />
                      <Controller
                        name="npwp.file_npwp"
                        control={control}
                        render={({ field }) => (
                          <InputDropzoneFile field={field} />
                        )}
                      />
                    </Field>
                    <Field
                      className={cn(
                        "grid gap-1.5 rounded-lg",
                        errors.telepon && "bg-red-200"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">
                          Telepon/Fax
                        </Label>
                        {errors.telepon ? (
                          <p className="text-xs/5 text-red-500">
                            {errors.telepon.message}
                          </p>
                        ) : null}
                      </div>
                      <Input {...register("telepon")} />
                    </Field>
                    <Field
                      className={cn(
                        "grid gap-1.5 rounded-lg",
                        errors.nomor && "bg-red-200"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">No. HP*</Label>
                        {errors.nomor ? (
                          <p className="text-xs/5 text-red-500">
                            {errors.nomor.message}
                          </p>
                        ) : null}
                      </div>
                      <Controller
                        control={control}
                        name="nomor"
                        render={({ field }) => (
                          <InputPhone {...field} value={field.value || ""} />
                        )}
                      />
                    </Field>

                    <Disclosure
                      as="div"
                      className="col-span-2"
                      defaultOpen={true}
                    >
                      <div
                        className={cn(
                          "group flex w-full items-center justify-between bg-slate-300 rounded px-2 py-1.5",
                          errors.pj && "bg-red-300"
                        )}
                      >
                        <span className="text-sm/6 font-medium text-center group-data-[hover]:text-gray-900/80">
                          Penanggung Jawab Perusahaan
                        </span>
                      </div>
                      <DisclosurePanel
                        transition
                        className="my-2 grid grid-cols-2 gap-1.5 text-sm origin-top transition duration-200 ease-out data-[closed]:-translate-y-3 data-[closed]:opacity-0"
                      >
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.pj?.nama && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              Nama*
                            </Label>
                            {errors.pj?.nama ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.pj?.nama.message}
                              </p>
                            ) : null}
                          </div>
                          <Input
                            {...register("pj.nama", {
                              onChange: (e) => {
                                if (watch("keuangan.sama"))
                                  setValue("keuangan.nama", e.target.value);
                                if (watch("teknisi.sama"))
                                  setValue("teknisi.nama", e.target.value);
                              },
                            })}
                          />
                        </Field>
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.pj?.jabatan && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              Jabatan*
                            </Label>
                            {errors.pj?.jabatan ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.pj?.jabatan.message}
                              </p>
                            ) : null}
                          </div>
                          <Input {...register("pj.jabatan")} />
                        </Field>
                        <Field
                          className={cn(
                            "flex flex-col col-span-2 gap-1.5 rounded-lg",
                            errors.identitas && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              NIK/Paspor Penanggung Jawab
                            </Label>
                            {errors.identitas ? (
                              <p className="text-xs/5 text-red-500">Invalid</p>
                            ) : null}
                          </div>
                          <div className="flex gap-1">
                            <InputRadioCheckbox
                              label="NIK"
                              value="NIK"
                              id="iden_nik"
                              type="radio"
                              className="size-3.5"
                              wrapperOnClick={() =>
                                setValue("identitas.jenis", "NIK")
                              }
                              {...register("identitas.jenis")}
                            />
                            <InputRadioCheckbox
                              label="Paspor"
                              value="Paspor"
                              id="iden_paspor"
                              type="radio"
                              className="size-3.5"
                              wrapperOnClick={() =>
                                setValue("identitas.jenis", "Paspor")
                              }
                              {...register("identitas.jenis")}
                            />
                            <Input
                              className="h-min"
                              {...register("identitas.nomor")}
                              placeholder="No. Identitas"
                            />
                          </div>
                          <Controller
                            name="identitas.file_identitas"
                            control={control}
                            render={({ field }) => (
                              <InputDropzoneFile field={field} />
                            )}
                          />
                        </Field>
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.pj?.nomor && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              No. Telepon*
                            </Label>
                            {errors.pj?.nomor ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.pj?.nomor.message}
                              </p>
                            ) : null}
                          </div>
                          <Controller
                            control={control}
                            name="pj.nomor"
                            render={({ field }) => (
                              <InputPhone
                                {...field}
                                onChange={(value) => {
                                  field.onChange(value);
                                  if (watch("keuangan.sama"))
                                    setValue("keuangan.nomor", value as string);
                                  if (watch("teknisi.sama"))
                                    setValue("teknisi.nomor", value as string);
                                }}
                              />
                            )}
                          />
                        </Field>
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.pj?.email && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              Email
                            </Label>
                            {errors.pj?.email ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.pj?.email.message}
                              </p>
                            ) : null}
                          </div>
                          <Input
                            {...register("pj.email", {
                              onChange: (e) => {
                                if (watch("keuangan.sama"))
                                  setValue("keuangan.email", e.target.value);
                                if (watch("teknisi.sama"))
                                  setValue("teknisi.email", e.target.value);
                              },
                            })}
                          />
                        </Field>
                      </DisclosurePanel>
                    </Disclosure>
                    <Disclosure
                      as="div"
                      className="col-span-2"
                      defaultOpen={false}
                    >
                      <DisclosureButton
                        className={cn(
                          "group flex w-full items-center justify-between bg-slate-300 rounded px-2 py-0.5",
                          errors.keuangan && "bg-red-300"
                        )}
                      >
                        <span className="text-sm/6 font-medium text-center group-data-[hover]:text-gray-900/80">
                          Penanggung Jawab Keuangan
                        </span>
                        <div className="flex items-center gap-2">
                          <Controller
                            control={control}
                            name="keuangan.sama"
                            render={({ field: { value, onChange } }) => {
                              const handleChange = (value: boolean) => {
                                if (value) {
                                  setValue("keuangan", {
                                    sama: value,
                                    nama: watch("pj.nama"),
                                    nomor: watch("pj.nomor"),
                                    email: watch("pj.email"),
                                  });
                                }
                                trigger("keuangan");
                              };

                              const handleOnChange = (
                                e: React.ChangeEvent<HTMLInputElement>
                              ) => {
                                const checked = e.target.checked;
                                handleChange(checked);
                                onChange(checked);
                              };

                              const handleWrapperClick = (
                                e: React.MouseEvent
                              ) => {
                                e.stopPropagation();
                                handleChange(!value);
                                onChange(!value);
                              };
                              return (
                                <InputRadioCheckbox
                                  label="Sama"
                                  id="keuangan_sama"
                                  checked={value || false}
                                  onChange={handleOnChange}
                                  type="checkbox"
                                  className="size-3.5"
                                  wrapperClassName={cn(
                                    "text-xs",
                                    errors.keuangan && "hover:bg-red-200"
                                  )}
                                  wrapperOnClick={handleWrapperClick}
                                />
                              );
                            }}
                          />
                          <ChevronDownIcon className="size-5 group-data-[open]:rotate-180" />
                        </div>
                      </DisclosureButton>
                      <DisclosurePanel
                        transition
                        className="my-2 grid grid-cols-2 gap-1.5 text-sm origin-top transition duration-200 ease-out data-[closed]:-translate-y-3 data-[closed]:opacity-0"
                      >
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.keuangan?.nama && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              Nama*
                            </Label>
                            {errors.keuangan?.nama ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.keuangan?.nama.message}
                              </p>
                            ) : null}
                          </div>
                          <Input
                            disabled={watch("keuangan.sama")}
                            {...register("keuangan.nama")}
                          />
                        </Field>
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.keuangan?.nomor && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              No. Telepon*
                            </Label>
                            {errors.keuangan?.nomor ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.keuangan?.nomor.message}
                              </p>
                            ) : null}
                          </div>
                          <Controller
                            control={control}
                            name="keuangan.nomor"
                            render={({ field: { value, ...rest } }) => (
                              <InputPhone
                                {...rest}
                                disabled={watch("keuangan.sama")}
                                value={value || ""}
                              />
                            )}
                          />
                        </Field>
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.keuangan?.email && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              Email
                            </Label>
                            {errors.keuangan?.email ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.keuangan?.email.message}
                              </p>
                            ) : null}
                          </div>
                          <Input
                            disabled={watch("keuangan.sama")}
                            {...register("keuangan.email")}
                          />
                        </Field>
                      </DisclosurePanel>
                    </Disclosure>
                    <Disclosure
                      as="div"
                      className="col-span-2"
                      defaultOpen={false}
                    >
                      <DisclosureButton
                        className={cn(
                          "group flex w-full items-center justify-between bg-slate-300 rounded px-2 py-0.5",
                          errors.teknisi && "bg-red-300"
                        )}
                      >
                        <span className="text-sm/6 font-medium text-center group-data-[hover]:text-gray-900/80">
                          Penanggung Jawab Teknis
                        </span>
                        <div className="flex items-center gap-2">
                          <Controller
                            control={control}
                            name="teknisi.sama"
                            render={({ field: { value, onChange } }) => {
                              const handleChange = (value: boolean) => {
                                if (value) {
                                  setValue("teknisi", {
                                    sama: value,
                                    nama: watch("pj.nama"),
                                    nomor: watch("pj.nomor"),
                                    email: watch("pj.email"),
                                  });
                                }
                                trigger("teknisi");
                              };

                              const handleOnChange = (
                                e: React.ChangeEvent<HTMLInputElement>
                              ) => {
                                const checked = e.target.checked;
                                handleChange(checked);
                                onChange(checked);
                              };

                              const handleWrapperClick = (
                                e: React.MouseEvent
                              ) => {
                                e.stopPropagation();
                                handleChange(!value);
                                onChange(!value);
                              };
                              return (
                                <InputRadioCheckbox
                                  label="Sama"
                                  id="teknisi_sama"
                                  checked={value || false}
                                  onChange={handleOnChange}
                                  type="checkbox"
                                  className="size-3.5"
                                  wrapperClassName={cn(
                                    "text-xs",
                                    errors.teknisi && "hover:bg-red-200"
                                  )}
                                  wrapperOnClick={handleWrapperClick}
                                />
                              );
                            }}
                          />
                          <ChevronDownIcon className="size-5 group-data-[open]:rotate-180" />
                        </div>
                      </DisclosureButton>
                      <DisclosurePanel
                        transition
                        className="my-2 grid grid-cols-2 gap-1.5 text-sm origin-top transition duration-200 ease-out data-[closed]:-translate-y-3 data-[closed]:opacity-0"
                      >
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.teknisi?.nama && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              Nama*
                            </Label>
                            {errors.teknisi?.nama ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.teknisi?.nama.message}
                              </p>
                            ) : null}
                          </div>
                          <Input
                            disabled={watch("teknisi.sama")}
                            {...register("teknisi.nama")}
                          />
                        </Field>
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.teknisi?.nomor && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              No. Telepon*
                            </Label>
                            {errors.teknisi?.nomor ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.teknisi?.nomor.message}
                              </p>
                            ) : null}
                          </div>
                          <Controller
                            control={control}
                            name="teknisi.nomor"
                            render={({ field }) => (
                              <InputPhone
                                {...field}
                                disabled={watch("teknisi.sama")}
                                value={field.value || ""}
                              />
                            )}
                          />
                        </Field>
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.teknisi?.email && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              Email
                            </Label>
                            {errors.teknisi?.email ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.teknisi?.email.message}
                              </p>
                            ) : null}
                          </div>
                          <Input
                            disabled={watch("teknisi.sama")}
                            {...register("teknisi.email")}
                          />
                        </Field>
                      </DisclosurePanel>
                    </Disclosure>
                  </fieldset>

                  <div className="flex justify-end gap-3 mt-6 sticky -bottom-4 bg-white border-t border-slate-200 py-2">
                    <Button
                      type="button"
                      color="red100"
                      onClick={close}
                      disabled={mutating}
                    >
                      Batal
                    </Button>
                    <Button type="submit" loading={mutating}>
                      {mutating ? "Menyimpan..." : "Simpan"}
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
