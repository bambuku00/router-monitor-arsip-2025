import { Button } from "@/components/button";
import {
  PembayaranPelanggan,
  PembayaranPelangganSchema,
} from "@/lib/pembayaran-types";
import { cn } from "@/lib/utils";
import {
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
import { Bank } from "@prisma/client";
import React, { useEffect, useRef, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { PembayaranLoadDataOpts } from "./data";
import BankSelect from "./bank-select";

type Props = {
  ids: number[];
  show: boolean;
  onClose: () => void;
  loadData: (opts?: PembayaranLoadDataOpts) => Promise<void>;
  canPayViaBank?: boolean;
};

export default function DialogBulkPembayaran({
  ids,
  show,
  onClose,
  loadData,
  canPayViaBank = true,
}: Props) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<PembayaranPelanggan>({
    resolver: zodResolver(
      PembayaranPelangganSchema.pick({
        metode: true,
        bankId: true,
      })
    ),
    defaultValues: {
      metode: canPayViaBank ? "Transfer" : "Cash",
    },
  });

  useEffect(() => {
    if (!show) {
        reset();
        return;
    }
    setValue("metode", canPayViaBank ? "Transfer" : "Cash");
  }, [show, reset, canPayViaBank, setValue]);

  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    if (watch("metode") === "Transfer" && !watch("bankId"))
      setError("bankId", { message: "Required" });
  }, [errors, watch, setError]);

  const [banks, setBanks] = useState<Bank[]>([]);
  const loadBank = async () => {
    try {
      const resp = await fetch(`/api/bank`);
      const json = await resp.json();
      if (!resp.ok) {
        const msg =
          typeof json?.error === "string"
            ? json.error
            : "Gagal memuat daftar bank";
        toast.error(msg);
        setBanks([]);
        return;
      }
      setBanks(json.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat daftar bank");
    }
  };

  const initialized = useRef<boolean>(false);
  useEffect(() => {
    if (!initialized.current) {
      loadBank();
      initialized.current = true;
    }
  }, []);
  
  const [mutating, setMutating] = useState<boolean>(false);

  const submitHandler: SubmitHandler<any> = async (data, e) => {
    e?.preventDefault();
    setMutating(true);
    try {
      if (watch("metode") === "Transfer" && !watch("bankId"))
        return setError("bankId", { message: "Required" });

      const postData = {
        ids,
        ...data,
      };

      const resp = await fetch(`/api/pembayaran/bulk`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(postData),
      });

      const json = await resp.json();
      if (!resp.ok) {
        const msg =
          (typeof json === "object" &&
          json &&
          typeof (json as { message?: string }).message === "string"
            ? (json as { message: string }).message
            : null) ||
          (typeof json === "object" &&
          json &&
          typeof (json as { error?: string }).error === "string"
            ? (json as { error: string }).error
            : null) ||
          (typeof json === "string" ? json : null) ||
          "Terjadi kesalahan";
        throw new Error(msg);
      }

      toast.success(json.message);
      await loadData({ refreshStats: true, silent: true });
      onClose();
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
      console.error(error);
    } finally {
      setMutating(false);
    }
  };

  return (
    <Transition show={show} as={React.Fragment}>
      <Dialog as="div" className="relative z-[1001]" onClose={onClose}>
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
              leave="ease-in duration-50"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 translate-x-5 scale-95"
            >
              <DialogPanel className="w-full max-w-xl transform overflow-hidden rounded-2xl bg-white p-6 pb-2 text-left text-gray-900 align-middle shadow-xl transition-all">
                <DialogTitle
                  as="div"
                  className="flex sticky -top-6 z-50 bg-white justify-between items-center border-b border-slate-200 font-medium leading-6 text-gray-900"
                >
                  <p className="text-base/7 text-center font-semibold">
                    Pembayaran Massal ({ids.length} item)
                  </p>
                </DialogTitle>
                <form
                  className="relative py-2 grid gap-2.5"
                  onSubmit={handleSubmit(submitHandler)}
                >
                  {/* Dummy input to prevent autofill */}
                  <input
                    type="text"
                    name="dummy_username"
                    autoComplete="username"
                    style={{ display: "none" }}
                  />
                  <input
                    type="password"
                    name="dummy_password"
                    autoComplete="current-password"
                    style={{ display: "none" }}
                  />
                  <Fieldset className="grid gap-2.5">
                    <Field className={cn("grid gap-1.5 rounded-lg")}>
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">
                          Metode Pembayaran*
                        </Label>
                      </div>
                      <div
                        className={cn(
                          "flex justify-around",
                          "*:flex *:gap-1.5 *:items-center *:cursor-pointer *:p-2 *:rounded-lg"
                        )}
                      >
                        {canPayViaBank ? (
                          <div
                            className="hover:bg-gray-100 *:cursor-pointer"
                            onClick={() => setValue("metode", "Transfer")}
                          >
                            <input
                              type="radio"
                              className="size-5 accent-green-600"
                              {...register("metode")}
                              value="Transfer"
                              id="bulk_mp_transfer"
                            />
                            <label htmlFor="bulk_mp_transfer">Transfer Manual</label>
                          </div>
                        ) : null}
                        <div
                          className="hover:bg-gray-100 *:cursor-pointer"
                          onClick={() => setValue("metode", "Cash")}
                        >
                          <input
                            type="radio"
                            className="size-5 accent-green-600"
                            {...register("metode")}
                            value={"Cash"}
                            id="bulk_mp_cash"
                          />
                          <label htmlFor="bulk_mp_cash">Cash</label>
                        </div>
                      </div>
                      {!canPayViaBank ? (
                        <p className="text-xs text-amber-700">
                          Akun Anda hanya boleh mencatat pembayaran tunai (Cash).
                        </p>
                      ) : null}
                    </Field>
                    <Transition
                      show={watch("metode") === "Transfer" && canPayViaBank}
                      as={React.Fragment}
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
                          errors.bankId && "bg-red-200"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <Label className="text-sm/6 font-medium">Bank*</Label>
                          {errors.bankId ? (
                            <p className="text-xs/5 text-red-500">
                              {errors.bankId.message}
                            </p>
                          ) : null}
                        </div>
                        <Controller
                          control={control}
                          name="bankId"
                          render={({
                            field: { onChange, value, disabled },
                          }) => (
                            <BankSelect
                              banks={banks}
                              value={value ?? undefined}
                              onChange={onChange}
                              disabled={disabled}
                            />
                          )}
                        />
                      </Field>
                    </Transition>
                  </Fieldset>
                  <div className="sticky -bottom-4 mt-4 border-t gap-1 bg-white border-slate-200 py-2 flex justify-end">
                    <Button
                      type="submit"
                      color="sky700"
                      loading={mutating}
                    >
                      Simpan
                    </Button>
                    <Button color="red100" onClick={onClose}>
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
