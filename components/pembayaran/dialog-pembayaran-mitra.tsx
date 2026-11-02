import { Button } from "@/components/button";
import { PembayaranMitra, PembayaranMitraSchema } from "@/lib/pembayaran-types";
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
import { Bank, MetodeBayar } from "@prisma/client";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { FaChevronDown } from "react-icons/fa";
import { FaCheck } from "react-icons/fa6";
import Fuse from "fuse.js";
import InputPassword from "../auth/input-password";
import { Input, InputIDR } from "../input";
import { PembayaranMitraAction, PembayaranMitraState } from "./page-data-mitra";

type Props = {
  state: PembayaranMitraState;
  dispatch: React.Dispatch<PembayaranMitraAction>;
  loadData: () => Promise<void>;
  bulan?: string;
};
export default function DialogPembayaranMitra({
  state,
  dispatch,
  loadData,
  bulan,
}: Props) {
  const { refresh } = useRouter();
  const show = useMemo(() => {
    return state.modal && (state.type === "payment" || !state.type);
  }, [state]);
  const close = () => {
    dispatch({ action: "close" });
    setTimeout(() => {
      dispatch({ action: "data", data: undefined });
      reset();
    }, 300);
  };
  const val = useMemo(() => state.data, [state]);
  const terbayar = useMemo(() => val?.pembayaran.status === "Terbayar", [val]);

  useEffect(() => {
    if (!state.modal) return;
    if (state.type === "invoice") return;
    if (!val) return;

    setValue("userId", val.id);
    setValue(
      "tanggal",
      bulan ? `${bulan}-01` : new Date().toLocaleDateString("fr-CA")
    );
    setValue("total", val.pembayaran.tagihanKantor);
    if (terbayar) {
      setValue("paid", val.pembayaran.bayar || 0);
    } else {
      setValue(
        "paid",
        Math.max(val.pembayaran.saldo, 0)
      );
    }
    setValue("metode", (val.pembayaran.metode as MetodeBayar) || "Transfer");
    if (val.pembayaran.bankId) {
      setValue("bankId", val.pembayaran.bankId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setValue/val from useForm declared below
  }, [state, terbayar]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<PembayaranMitra>({
    resolver: zodResolver(PembayaranMitraSchema),
    defaultValues: {
      tanggal: "",
      password: "",
      paid: 0,
      userId: 0,
      total: 0,
      metode: "Transfer",
    },
  });
  // useEffect(() => {
  //   console.log(errors);
  // }, [errors]);
  // useEffect(() => {
  //   const subscription = watch((value, { name, type }) =>
  //     console.log(value, name, type)
  //   );
  //   return () => subscription.unsubscribe();
  // }, [watch]);

  const [banks, setBanks] = useState<Bank[]>([]);
  const loadBank = async () => {
    try {
      const resp = await fetch(`/api/bank?role=Superadmin`);
      const json = await resp.json();
      setBanks(json.data || []);
    } catch (err) {
      const error = err as Error;
      console.error(error);
    }
  };

  const initialized = useRef<boolean>(false);
  useEffect(() => {
    if (!initialized.current) {
      loadBank();
      initialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);
  const [queryBank, setQueryBank] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(banks || [], {
        keys: ["nama", "bank", "norek"],
        threshold: 0.3,
      }),
    [banks]
  );

  const filteredBanks = useMemo(() => {
    return queryBank === ""
      ? banks
      : fuse.search(queryBank).map((val) => val.item);
  }, [banks, queryBank, fuse]);

  const [mutating, setMutating] = useState<boolean>(false);
  const submitHandler: SubmitHandler<PembayaranMitra> = async (data, e) => {
    e?.preventDefault();
    setMutating(true);
    try {
      //   if (val?.pembayaran.status !== "Terbayar") {
      if (!terbayar) {
        const post = await fetch(`/api/pembayaran/mitra`, {
          method: "POST",
          body: JSON.stringify(data),
        });
        const resp = await post.json();
        if (!resp.data?.id)
          throw new Error(
            resp.error || resp.message || "Terjadi kesalahan pada server"
          );
        toast.success(resp.message);
      } else {
        const del = await fetch(`/api/pembayaran/mitra`, {
          method: "DELETE",
          body: JSON.stringify(data),
        });
        const resp = await del.json();
        if (!resp.data?.id)
          throw new Error(
            resp.error || resp.message || "Terjadi kesalahan pada server"
          );
        toast.success(resp.message);
      }
      loadData();
      close();
      // refresh();
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
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
              <DialogPanel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 pb-2 text-left text-gray-900 align-middle shadow-xl transition-all">
                <DialogTitle
                  as="div"
                  className="flex sticky -top-6 z-50 bg-white justify-between items-center border-b border-slate-200 font-medium leading-6 text-gray-900"
                >
                  <p className="text-base/7 text-center font-semibold">
                    Pembayaran {val?.ownedByIsp ? "" : "Mitra "}{val?.nama}
                  </p>
                </DialogTitle>
                <form
                  className="relative py-2 grid gap-2.5"
                  onSubmit={handleSubmit(submitHandler)}
                >
                  <dl>
                    <dt className="text-sm/6 font-medium">Nama</dt>
                    <dd>{val?.nama}</dd>
                  </dl>
                  <dl>
                    <dt className="text-sm/6 font-medium">Pembagian hasil bersih</dt>
                    <dd>
                      {val?.ownedByIsp
                        ? "Akun milik ISP. Pendapatan bersih tidak dibagi. Bruto bulan ini: "
                        : "50% mitra / 50% kantor (setelah dikurangi PPN). Bruto bulan ini: "}
                      {val?.pembayaran?.total.toLocaleString("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      })}
                    </dd>
                  </dl>
                  <dl>
                    <dt className="text-sm/6 font-medium">Nominal Bayar</dt>
                    <dd>
                      {((val?.pembayaran?.kantor ?? 0) + (val?.pembayaran?.ppn ?? 0)).toLocaleString(
                        "id-ID",
                        {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        }
                      )}
                    </dd>
                  </dl>
                  <dl>
                    <dt className="text-sm/6 font-medium">Sudah Terbayar</dt>
                    <dd>
                      {val?.pembayaran.bayar.toLocaleString("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      })}
                    </dd>
                  </dl>
                  <Fieldset className="grid gap-2.5">
                    <Field
                      className={cn(
                        "grid gap-1.5 rounded-lg",
                        errors.tanggal && "bg-red-200"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">
                          Tanggal*
                        </Label>
                        {errors.tanggal ? (
                          <p className="text-xs/5 text-red-500">
                            {errors.tanggal.message}
                          </p>
                        ) : null}
                      </div>
                      <Input type="date" {...register("tanggal")} />
                    </Field>
                    <Field
                      className={cn(
                        "grid gap-1.5 rounded-lg",
                        errors.paid && "bg-red-200"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">
                          {terbayar ? "Nominal Batal*" : "Bayar*"}
                        </Label>
                        {errors.paid ? (
                          <p className="text-xs/5 text-red-500">
                            {errors.paid.message}
                          </p>
                        ) : null}
                      </div>
                      <Controller
                        control={control}
                        name="paid"
                        render={({ field: { onChange, value, onBlur } }) => (
                          <InputIDR
                            value={value || ""}
                            onBlur={onBlur}
                            step={1000}
                            onValueChange={(val) =>
                              onChange(parseFloat(val || ""))
                            }
                          />
                        )}
                      />
                    </Field>
                    <Field className={cn("grid gap-1.5 rounded-lg")}>
                      <div
                        className={cn(
                          "flex justify-around",
                          "*:flex *:gap-1.5 *:items-center *:cursor-pointer *:p-2 *:rounded-lg",
                          terbayar && "*:cursor-default"
                        )}
                      >
                        <div
                          className={cn(
                            "hover:bg-gray-100   *:cursor-pointer",
                            terbayar && "*:cursor-default"
                          )}
                          onClick={() =>
                            !terbayar && setValue("metode", "Transfer")
                          }
                        >
                          <input
                            type="radio"
                            disabled={terbayar}
                            className="size-5 accent-green-600"
                            {...register("metode")}
                            value="Transfer"
                            id="mp_transfer"
                          />
                          <label htmlFor="mp_transfer">Transfer Manual</label>
                        </div>
                        <div
                          className={cn(
                            "hover:bg-gray-100   *:cursor-pointer",
                            terbayar && "*:cursor-default"
                          )}
                          onClick={() =>
                            !terbayar && setValue("metode", "Cash")
                          }
                        >
                          <input
                            type="radio"
                            disabled={terbayar}
                            className="size-5 accent-green-600"
                            {...register("metode")}
                            value="Cash"
                            id="mp_cash"
                          />
                          <label htmlFor="mp_cash">Cash</label>
                        </div>
                      </div>
                    </Field>
                    <Transition
                      show={watch("metode") === "Transfer"}
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
                          disabled={terbayar}
                          render={({
                            field: { onChange, value, disabled },
                          }) => (
                            <Combobox
                              value={
                                banks.find((bankVal) => bankVal.id == value) ||
                                null
                              }
                              onChange={(changeVal) => onChange(changeVal?.id)}
                              onClose={() => setQueryBank("")}
                              disabled={disabled}
                            >
                              <div className="relative">
                                <ComboboxInput
                                  autoComplete="new-password"
                                  className={cn(
                                    "w-full rounded-lg border-none bg-slate-200/80 py-1.5 pr-8 pl-3 text-sm/6",
                                    "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25"
                                  )}
                                  displayValue={(displayValue: Bank | null) =>
                                    displayValue
                                      ? displayValue?.bank +
                                        " - " +
                                        displayValue?.norek +
                                        " " +
                                        displayValue?.nama
                                      : ""
                                  }
                                  onChange={(event) =>
                                    setQueryBank(event.target.value)
                                  }
                                />
                                <ComboboxButton className="group absolute top-1/2 -translate-y-1/2 right-0 px-2.5">
                                  <FaChevronDown className="size-4 fill-gray-900/60 group-data-[hover]:fill-gray-900" />
                                </ComboboxButton>
                              </div>

                              <ComboboxOptions
                                transition
                                anchor="bottom"
                                className={cn(
                                  "w-[var(--input-width)] rounded-xl border border-slate-300/80 bg-slate-200 p-1 [--anchor-gap:var(--spacing-1)] empty:invisible",
                                  "transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0"
                                )}
                              >
                                {filteredBanks.map((b) => (
                                  <ComboboxOption
                                    key={b.id}
                                    value={b}
                                    className="group flex justify-between cursor-pointer items-center gap-2 rounded-lg py-1.5 px-3 select-none data-[hover]:bg-slate-200/30 data-[active]:bg-slate-100"
                                  >
                                    <div>
                                      <p className="text-sm/6 text-gray-900">
                                        {b.bank}
                                      </p>
                                      <p className="text-sm/7 text-gray-900">
                                        {`${b.norek} - ${b.nama}`}
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
                      <InputPassword {...register("password")} />
                    </Field>
                  </Fieldset>
                  <div className="sticky -bottom-4 mt-4 border-t gap-1 bg-white border-slate-200 py-2 flex justify-end">
                    <Button
                      type="submit"
                      color={terbayar ? "red" : "sky700"}
                      loading={mutating}
                    >
                      {terbayar ? "Batalkan Pembayaran" : "Simpan"}
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
