import { Button } from "@/components/button";
import { Input } from "@/components/input";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Field,
  Label,
  Select,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Router } from "@prisma/client";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TbChevronDown } from "react-icons/tb";
import { clsx } from "clsx";
import { revalidatePPP, syncPPP } from "@/lib/server-actions/router/ppp/actions";
import { isPppSyncError } from "@/lib/ppp-sync/result";
import {
  getApiResponseErrorMessage,
  getErrorMessage,
} from "@/lib/get-error-message";

type FormData = {
  name: string;
  password: string;
  service: string;
  profile: string;
  localAddress?: string;
  remoteAddress?: string;
  comment?: string;
};

type Props = {
  isOpen: boolean;
  close: () => void;
  router: Pick<Router, "id"> | undefined;
  profiles: string[];
};

export default function DialogAdd({ isOpen, close, router, profiles }: Props) {
  const { refresh } = useRouter();
  const [mutating, setMutating] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      service: "pppoe",
      profile: "default",
    },
  });

  const submitHandler: SubmitHandler<FormData> = async (data) => {
    if (!router) return;
    setMutating(true);
    const toastId = toast.loading("Menambahkan user PPP...");
    try {
      const resp = await fetch(`/api/router/${router.id}/ppp/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(getApiResponseErrorMessage(json, resp, "Gagal menambahkan user"));
      }

      toast.success("Berhasil menambahkan user PPP. Sedang sinkronisasi...", { id: toastId });
      
      const sync = await syncPPP(router.id);
      if (isPppSyncError(sync)) {
        throw new Error(getErrorMessage(sync.error, "Gagal sinkronisasi PPP"));
      }

      await revalidatePPP();
      reset();
      close();
      refresh();
      toast.success("User berhasil ditambahkan dan disinkronkan!", { id: toastId });
    } catch (err) {
      toast.error(getErrorMessage(err, "Gagal menambahkan user PPP"), {
        id: toastId,
      });
    } finally {
      setMutating(false);
    }
  };

  return (
    <Transition show={isOpen} as={React.Fragment}>
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
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <DialogTitle
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 mb-4"
                >
                  Tambah User PPP
                </DialogTitle>
                <form
                  onSubmit={handleSubmit(submitHandler)}
                  className="flex flex-col gap-4"
                >
                  <Field>
                    <Label className="text-sm font-medium text-slate-700">
                      Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      {...register("name", { required: "Nama wajib diisi" })}
                      className="mt-1"
                      placeholder="Username PPPoE"
                    />
                    {errors.name && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.name.message}
                      </p>
                    )}
                  </Field>

                  <Field>
                    <Label className="text-sm font-medium text-slate-700">
                      Password <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      {...register("password", {
                        required: "Password wajib diisi",
                      })}
                      className="mt-1"
                      type="password"
                      placeholder="Password PPPoE"
                    />
                    {errors.password && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.password.message}
                      </p>
                    )}
                  </Field>

                  <Field>
                    <Label className="text-sm font-medium text-slate-700">
                      Service
                    </Label>
                    <div className="relative mt-1">
                      <Select
                        {...register("service")}
                        className={clsx(
                          "block w-full appearance-none rounded-lg border-none bg-black/5 py-1.5 px-3 text-sm/6 text-slate-900",
                          "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25",
                          "*:text-black"
                        )}
                      >
                        <option value="any">any</option>
                        <option value="pppoe">pppoe</option>
                        <option value="pptp">pptp</option>
                        <option value="sstp">sstp</option>
                        <option value="l2tp">l2tp</option>
                        <option value="ovpn">ovpn</option>
                      </Select>
                      <TbChevronDown
                        className="group pointer-events-none absolute top-2.5 right-2.5 size-4 fill-slate-700/60"
                        aria-hidden="true"
                      />
                    </div>
                  </Field>

                  <Field>
                    <Label className="text-sm font-medium text-slate-700">
                      Profile
                    </Label>
                    <div className="relative mt-1">
                      <Select
                        {...register("profile")}
                        className={clsx(
                          "block w-full appearance-none rounded-lg border-none bg-black/5 py-1.5 px-3 text-sm/6 text-slate-900",
                          "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25",
                          "*:text-black"
                        )}
                      >
                        <option value="default">default</option>
                        {profiles.filter(p => p !== 'default').map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </Select>
                      <TbChevronDown
                        className="group pointer-events-none absolute top-2.5 right-2.5 size-4 fill-slate-700/60"
                        aria-hidden="true"
                      />
                    </div>
                  </Field>
                  
                  <Field>
                    <Label className="text-sm font-medium text-slate-700">
                      Remote Address
                    </Label>
                    <Input
                        {...register("remoteAddress")}
                        className="mt-1"
                        placeholder="IP Address (Optional)"
                    />
                  </Field>

                   <Field>
                    <Label className="text-sm font-medium text-slate-700">
                      Comment
                    </Label>
                    <Input
                        {...register("comment")}
                        className="mt-1"
                        placeholder="Komentar (Optional)"
                    />
                  </Field>

                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      type="button"
                      onClick={close}
                      className="bg-slate-200 text-slate-800 hover:bg-slate-300"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      disabled={mutating}
                      className="bg-sky-600 text-white hover:bg-sky-700"
                    >
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
