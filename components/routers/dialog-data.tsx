import { Button } from "@/components/button";
import { Input } from "@/components/input";
import {
  RouterOptionalDefaults as Router,
  RouterOptionalDefaultsSchema,
} from "@/prisma/generated/zod";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Field,
  Fieldset,
  Label,
  Select,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TbChevronDown } from "react-icons/tb";
import { EditAction, EditState } from "./data";
import { SessionLucia } from "@/lib/auth";
import { formatRouterOsVersionLabel } from "@/lib/routeros-version";
import Maps from "../maps";
import { cn, coorMalangArr } from "@/lib/utils";
import { z } from "zod";

/** Lebih lama dari timeout RouterOS di server + buffer supaya UI tidak menggantung tanpa pesan. */
const ROUTER_FORM_FETCH_MS = 40_000;

/** Edit: password boleh kosong (pertahankan yang tersimpan). Create: wajib. */
const RouterFormSchema = RouterOptionalDefaultsSchema.extend({
  password: z.string().optional(),
  pppProfileBackup: z.any().nullish(),
}).superRefine((data, ctx) => {
  const isCreate = data.id == null;
  if (isCreate && (!data.password || data.password.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["password"],
      message: "Required",
    });
  }
});

type Props = {
  add: boolean;
  setAdd: React.Dispatch<React.SetStateAction<boolean>>;
  edit: EditState;
  editDispatch: React.Dispatch<EditAction>;
};
export default function DialogData({ add, setAdd, edit, editDispatch }: Props) {
  const {
    register,
    handleSubmit,
    unregister,
    setValue,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<Router>({
    resolver: zodResolver(RouterFormSchema),
  });

  const { refresh } = useRouter();
  const show = useMemo(() => {
    return add || edit.modal;
  }, [add, edit]);
  const close = () => {
    reset();
    if (!add) {
      editDispatch({ action: "close" });
      // editDispatch({ action: "data", data: undefined });
      setTimeout(() => editDispatch({ action: "data", data: undefined }), 300);
    } else {
      setAdd(false);
    }
  };
  const val = useMemo(() => edit.data, [edit]);

  const [session, setSession] = useState<SessionLucia>();
  const loadSession = async () => {
    try {
      const resp = await fetch("/api/auth/session");
      const json = await resp.json();
      if (!resp.ok) throw new Error(json || "Terjadi kesalahan pada server");
      setSession(json.data);
    } catch (err) {
      const error = err as Error;
      if (error.message !== "Unauthorized") console.error(error);
    }
  };
  const initialized = useRef<boolean>(false);
  useEffect(() => {
    if (!initialized.current) {
      loadSession();

      initialized.current = true;
    }
  }, []);

  const host = watch("host");
  const port = watch("port");
  const routerUser = watch("user");
  const password = watch("password");
  const osVersion = watch("os_version");

  const [detectingVersion, setDetectingVersion] = useState(false);
  const [versionLabel, setVersionLabel] = useState<string | null>(null);
  const detectAbortRef = useRef<AbortController | null>(null);
  const lastDetectKeyRef = useRef("");

  useEffect(() => {
    if (!show) {
      lastDetectKeyRef.current = "";
      setVersionLabel(null);
      setDetectingVersion(false);
      detectAbortRef.current?.abort();
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;

    const hostVal = host?.trim();
    const userVal = routerUser?.trim();
    const passVal = password?.trim();
    if (!hostVal || !port || !userVal || !passVal) {
      if (!edit.modal) {
        setValue("os_version", "");
        setVersionLabel(null);
        lastDetectKeyRef.current = "";
      }
      return;
    }

    const detectKey = `${hostVal}|${port}|${userVal}|${passVal}`;
    if (detectKey === lastDetectKeyRef.current) return;

    const timer = globalThis.setTimeout(async () => {
      detectAbortRef.current?.abort();
      const ctrl = new AbortController();
      detectAbortRef.current = ctrl;
      setDetectingVersion(true);

      try {
        const res = await fetch("/api/router/detect-version", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            host: hostVal,
            port,
            user: userVal,
            password: passVal,
          }),
          signal: ctrl.signal,
        });
        const json = (await res.json()) as {
          data?: { os_version: "v6" | "v7"; version: string };
          error?: string;
        };
        if (!res.ok || !json.data?.os_version) {
          throw new Error(json.error || "Gagal mendeteksi versi");
        }

        setValue("os_version", json.data.os_version);
        setVersionLabel(
          formatRouterOsVersionLabel(json.data.os_version, json.data.version)
        );
        lastDetectKeyRef.current = detectKey;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setVersionLabel(null);
      } finally {
        setDetectingVersion(false);
      }
    }, 700);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [
    show,
    host,
    port,
    routerUser,
    password,
    edit.modal,
    setValue,
  ]);

  useEffect(() => {
    setValue("userId", session?.user?.id ?? null);

    if (!val?.id) return;
    setValue("id", val.id);
    setValue("nama", val.nama);
    setValue("user", val.user ?? "");
    setValue("host", val.host);
    setValue("port", val.port);
    setValue("password", "");
    setValue("lat", val.lat);
    setValue("lng", val.lng);
    setValue("os_version", val.os_version || "");
    if (val.os_version) {
      setVersionLabel(
        val.os_version === "v7" ? "RouterOS v7" : "RouterOS v6"
      );
      lastDetectKeyRef.current = `${val.host}|${val.port}|${val.user}|`;
    } else {
      lastDetectKeyRef.current = "";
    }

    return () => {
      reset();
    };
  }, [val, session, reset, setValue]);

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
  const submitHandler: SubmitHandler<Router> = async (data, e) => {
    e?.preventDefault();
    setMutating(true);
    // Sanitize data
    const payload = {
      ...data,
      os_version: data.os_version === "" ? null : data.os_version,
      pppProfileBackup: null,
    };
    const ctrl = new AbortController();
    const tid = globalThis.setTimeout(() => ctrl.abort(), ROUTER_FORM_FETCH_MS);
    try {
      const readRouterSaveResponse = async (res: Response) => {
        const raw = await res.text();
        let body: { data?: { id?: number }; error?: string; message?: string };
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error(
            res.ok
              ? "Respons server tidak valid."
              : `Gagal menyimpan (${res.status}).`
          );
        }
        if (!res.ok || !body.data?.id) {
          throw new Error(
            body.error ||
              body.message ||
              (res.ok ? "Data router tidak lengkap dari server." : `Gagal (${res.status})`)
          );
        }
        return body;
      };

      if (!val?.id) {
        const post = await fetch("/api/router", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        const resp = await readRouterSaveResponse(post);
        toast.success(resp.message ?? "Berhasil menambah router");
      } else {
        const put = await fetch(`/api/router/${data.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        const resp = await readRouterSaveResponse(put);
        toast.success(resp.message ?? "Berhasil mengubah router");
      }
      close();
      refresh();
    } catch (err) {
      const error = err as Error & { name?: string };
      if (error.name === "AbortError") {
        toast.error(
          "Permintaan habis waktu (±40 detik). Host/port mungkin tidak terjangkau dari server aplikasi atau RouterOS tidak merespons."
        );
      } else {
        toast.error(error.message);
        console.error(error.message);
      }
    } finally {
      globalThis.clearTimeout(tid);
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
                  <p>Router {val?.nama}</p>
                  <p className="text-base/7 text-center font-semibold">
                    Isi Data Router
                  </p>
                </DialogTitle>
                <form
                  className="relative"
                  onSubmit={handleSubmit(submitHandler, (formErrors) => {
                    const first = Object.values(formErrors).find(
                      (issue) => issue && typeof issue.message === "string" && issue.message
                    );
                    toast.error(
                      first && typeof first.message === "string"
                        ? first.message
                        : "Isian router belum lengkap."
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
                        <Input {...register("nama")} />
                      </Field>
                      <div className="flex gap-1.5">
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg flex-1",
                            errors.host && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              Host*
                            </Label>
                            {errors.host ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.host.message}
                              </p>
                            ) : null}
                          </div>
                          <Input {...register("host")} />
                        </Field>
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.port && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              Port*
                            </Label>
                            {errors.port ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.port.message}
                              </p>
                            ) : null}
                          </div>
                          <Input
                            type="number"
                            {...register("port", {
                              valueAsNumber: true,
                            })}
                          />
                        </Field>
                      </div>
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
                              {val?.id
                                ? "Password (kosongkan jika tidak diubah)"
                                : "Password*"}
                            </Label>
                            {errors.password ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.password.message}
                              </p>
                            ) : null}
                          </div>
                          <Input
                            {...register("password")}
                            type={
                              session?.user?.role === "Superadmin"
                                ? "text"
                                : "password"
                            }
                          />
                        </Field>
                      </div>
                      <Field className="grid gap-1.5">
                        <div className="flex justify-between items-center gap-2">
                          <Label className="text-sm/6 font-medium">
                            Versi Mikrotik
                          </Label>
                          {detectingVersion ? (
                            <span className="text-xs text-slate-500">
                              Mendeteksi versi...
                            </span>
                          ) : versionLabel ? (
                            <span className="text-xs text-emerald-600">
                              {versionLabel}
                            </span>
                          ) : null}
                        </div>
                        <div className="relative">
                          <Select
                            {...register("os_version")}
                            disabled={detectingVersion}
                            className={cn(
                              "block w-full appearance-none rounded-lg border-none bg-black/5 py-1.5 px-3 text-sm/6",
                              "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25",
                              detectingVersion && "opacity-60"
                            )}
                          >
                            <option value="">
                              {detectingVersion
                                ? "Mendeteksi..."
                                : "Isi koneksi router dulu"}
                            </option>
                            <option value="v6">RouterOS v6</option>
                            <option value="v7">RouterOS v7</option>
                          </Select>
                          <TbChevronDown
                            className="group pointer-events-none absolute top-2.5 right-2.5 size-4 fill-black/60"
                            aria-hidden="true"
                          />
                        </div>
                        {!detectingVersion && !osVersion ? (
                          <p className="text-[11px] text-slate-500">
                            Versi terisi otomatis setelah host, port, username, dan
                            password valid.
                          </p>
                        ) : null}
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
                            zoom={13}
                            initCenter={coorMalangArr}
                            onClickMap={onClickMap}
                            markerCoordinates={coordinates}
                          />
                        </div>
                      </Field>
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
