import { Button } from "@/components/button";
import {
  PembayaranPelanggan,
  PembayaranPelangganSchema,
  pembayaranBayarSekaligusLabel,
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
import { Bank, RoleName } from "@prisma/client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  formatBillingPeriodLabel,
  prepaidBillingPeriods,
} from "@/lib/billing-due-date";
import { PembayaranAction, PembayaranLoadDataOpts, PembayaranState } from "./data";
import BankSelect from "./bank-select";
import DialogDelete from "./dialog-delete";

function apiErrorMessage(json: unknown, resp: Response): string {
  if (typeof json === "string") return json;
  if (json && typeof json === "object") {
    const o = json as { message?: unknown; error?: unknown };
    if (typeof o.message === "string") return o.message;
    if (typeof o.error === "string") return o.error;
  }
  return resp.statusText || "Terjadi kesalahan";
}

type Props = {
  state: PembayaranState;
  dispatch: React.Dispatch<PembayaranAction>;
  loadData: (opts?: PembayaranLoadDataOpts) => Promise<void>;
  role: RoleName;
  canPayViaBank?: boolean;
  canCancel?: boolean;
  sheet?: boolean;
};
export default function DialogPembayaran({
  state,
  dispatch,
  loadData,
  role,
  canPayViaBank = true,
  canCancel = true,
  sheet = false,
}: Props) {
  const show = useMemo(() => {
    return state.modal;
  }, [state]);
  const val = useMemo(() => state.data, [state]);
  const terbayar = useMemo(() => val?.pembayaran.status === "Terbayar", [val]);
  const petugasSatuBulan = role === RoleName.Petugas;
  const sekaligusLabel = pembayaranBayarSekaligusLabel(
    val?.pembayaran.bayarSekaligus
  );

  const {
    register,
    handleSubmit,
    unregister,
    setError,
    setValue,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<PembayaranPelanggan>({
    resolver: zodResolver(PembayaranPelangganSchema),
  });

  const close = () => {
    dispatch({ action: "close" });
    setTimeout(() => {
      dispatch({ action: "data", data: undefined });
      reset();
    }, 300);
  };

  const [hapusDialog, setHapusDialog] = useState(false);

  useEffect(() => {
    if (!state.modal) return;
    if (!val?.pembayaran) return;

    if (val?.pembayaran.status === "Belum") {
      setValue("metode", canPayViaBank ? "Transfer" : "Cash");
      setValue("total", val.pembayaran.total);
      setValue("bulanBayar", 1);
    } else {
      setValue("metode", val.pembayaran.metode);
      setValue("bankId", val.pembayaran.bankId);
      setValue("total", val.pembayaran.total);
    }
  }, [state, setValue, val, canPayViaBank]);
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    if (watch("metode") === "Transfer" && !watch("bankId") && !terbayar)
      setError("bankId", { message: "Required" });
  }, [errors, setError, terbayar, watch]);
  // useEffect(() => {
  //   const subscription = watch((value, { name, type }) =>
  //     console.log(value, name, type)
  //   );
  //   return () => subscription.unsubscribe();
  // }, [watch]);

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
      const error = err as Error;
      console.error(error);
      toast.error("Gagal memuat daftar bank");
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
  const [mutating, setMutating] = useState<boolean>(false);
  const submitHandler: SubmitHandler<PembayaranPelanggan> = async (data, e) => {
    e?.preventDefault();
    setMutating(true);
    try {
      if (watch("metode") === "Transfer" && !watch("bankId") && !terbayar)
        return setError("bankId", { message: "Required" });
      const pembayaranId = val?.pembayaran.id;
      if (!pembayaranId) throw new Error("Tagihan tidak ditemukan");

      if (terbayar && !canCancel) {
        throw new Error("Anda tidak diizinkan membatalkan pembayaran");
      }

      if (!terbayar) {
        const resp = await fetch(`/api/pembayaran/${pembayaranId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            total: val?.pembayaran.total,
            ...(petugasSatuBulan ? { bulanBayar: 1 } : {}),
          }),
        });
        let json: unknown;
        try {
          json = await resp.json();
        } catch {
          json = null;
        }
        if (!resp.ok) throw new Error(apiErrorMessage(json, resp));
        toast.success(
          typeof json === "object" &&
            json &&
            typeof (json as { message?: string }).message === "string"
            ? (json as { message: string }).message
            : "Pembayaran telah berhasil"
        );
      } else {
        const resp = await fetch(`/api/pembayaran/delete/${pembayaranId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        });
        let json: unknown;
        try {
          json = await resp.json();
        } catch {
          json = null;
        }
        if (!resp.ok) throw new Error(apiErrorMessage(json, resp));
        toast.success(
          typeof json === "object" &&
            json &&
            typeof (json as { message?: string }).message === "string"
            ? (json as { message: string }).message
            : "Pembayaran telah dibatalkan"
        );
      }
      await loadData({ refreshStats: true, silent: true });
      close();
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
      <Dialog as="div" className="relative z-[1100]" onClose={close}>
        <TransitionChild
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className={cn(
              "fixed inset-0",
              sheet ? "bg-black/50" : "bg-black bg-opacity-25"
            )}
          />
        </TransitionChild>
        <div
          className={cn(
            sheet
              ? "fixed inset-x-0 top-0 flex justify-center"
              : "fixed inset-0 overflow-y-auto"
          )}
        >
          <div
            className={cn(
              sheet
                ? "flex w-full max-w-lg px-3"
                : "flex min-h-full items-center justify-center p-4 text-center"
            )}
          >
            <TransitionChild
              as={React.Fragment}
              enter={sheet ? "ease-out duration-300" : "ease-out duration-300"}
              enterFrom={sheet ? "-translate-y-full" : "opacity-0 scale-95"}
              enterTo={sheet ? "translate-y-0" : "opacity-100 scale-100"}
              leave={sheet ? "ease-in duration-200" : "ease-in duration-50"}
              leaveFrom={sheet ? "translate-y-0" : "opacity-100 scale-100"}
              leaveTo={sheet ? "-translate-y-full" : "opacity-0 translate-x-5 scale-95"}
            >
              <DialogPanel
                className={cn(
                  "w-full transform bg-white text-left text-gray-900 align-middle shadow-xl transition-all dark:bg-theme-card dark:text-theme-fg",
                  sheet
                    ? "flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-3xl"
                    : "max-w-2xl overflow-hidden rounded-2xl p-6 pb-2"
                )}
              >
                {sheet ? (
                  <form
                    className="flex min-h-0 flex-1 flex-col overflow-y-auto"
                    onSubmit={handleSubmit(submitHandler)}
                  >
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
                    <input type="hidden" {...register("metode")} />
                    <input
                      type="hidden"
                      {...register("bulanBayar", { valueAsNumber: true })}
                    />
                    <div className="sticky top-0 z-10 bg-white px-5 pb-3 pt-4 dark:bg-theme-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <DialogTitle className="truncate text-lg font-semibold">
                            {val?.nama || "Pembayaran"}
                          </DialogTitle>
                          {sekaligusLabel ? (
                            <p className="mt-0.5 text-sm font-semibold text-amber-700">
                              {sekaligusLabel}
                            </p>
                          ) : null}
                          {val?.alamat?.trim() && val.alamat.trim() !== "-" ? (
                            <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-theme-fg-muted">
                              {val.alamat.trim()}
                            </p>
                          ) : null}
                          {val?.nomor?.trim() && val.nomor.trim() !== "-" ? (
                            <p className="mt-0.5 text-sm text-slate-500 dark:text-theme-fg-muted">
                              {val.nomor.trim()}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={close}
                          aria-label="Tutup"
                          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xl leading-none text-slate-600 dark:bg-theme-elevated dark:text-theme-fg"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-5 px-5 pb-4">
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 dark:bg-theme-elevated">
                        <p className="text-xs font-medium text-slate-500 dark:text-theme-fg-muted">
                          Tagihan
                        </p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">
                          {(val?.pembayaran.total ?? 0).toLocaleString("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            maximumFractionDigits: 0,
                          })}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-theme-fg-muted">
                          per bulan
                        </p>
                      </div>
                      {terbayar ? (
                        <div className="rounded-2xl bg-green-50 px-4 py-3 text-green-800 dark:bg-green-950/40 dark:text-green-300">
                          <p className="text-sm font-medium">Sudah lunas</p>
                          <p className="mt-1 text-base font-semibold">
                            {watch("metode") === "Cash" ? "Tunai" : "Transfer"}
                          </p>
                        </div>
                      ) : (
                        <>
                          {val?.pembayaran.jatuh_tempo && !petugasSatuBulan ? (
                            <div>
                              <p className="mb-2 text-sm font-semibold">
                                Bayar berapa bulan
                              </p>
                              <div className="grid grid-cols-6 gap-2">
                                {[1, 2, 3, 4, 5, 6].map((n) => {
                                  const active =
                                    (Number(watch("bulanBayar")) || 1) === n;
                                  return (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={() =>
                                        setValue("bulanBayar", n, {
                                          shouldDirty: true,
                                        })
                                      }
                                      className={cn(
                                        "h-11 rounded-xl text-sm font-semibold",
                                        active
                                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                          : "bg-slate-100 text-slate-700 dark:bg-theme-elevated dark:text-theme-fg"
                                      )}
                                    >
                                      {n}
                                    </button>
                                  );
                                })}
                              </div>
                              <p className="mt-2 text-xs text-slate-500 dark:text-theme-fg-muted">
                                Lunas:{" "}
                                {prepaidBillingPeriods(
                                  val.pembayaran.jatuh_tempo,
                                  Number(watch("bulanBayar")) || 1
                                )
                                  .map(formatBillingPeriodLabel)
                                  .join(", ")}
                              </p>
                            </div>
                          ) : null}
                          <div>
                            <p className="mb-2 text-sm font-semibold">Cara bayar</p>
                            <div
                              className={cn(
                                "grid gap-2",
                                canPayViaBank ? "grid-cols-2" : "grid-cols-1"
                              )}
                            >
                              {canPayViaBank ? (
                                <button
                                  type="button"
                                  onClick={() => setValue("metode", "Transfer")}
                                  className={cn(
                                    "h-12 rounded-xl text-base font-semibold",
                                    watch("metode") === "Transfer"
                                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                      : "bg-slate-100 text-slate-700 dark:bg-theme-elevated dark:text-theme-fg"
                                  )}
                                >
                                  Transfer
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => setValue("metode", "Cash")}
                                className={cn(
                                  "h-12 rounded-xl text-base font-semibold",
                                  watch("metode") === "Cash"
                                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                    : "bg-slate-100 text-slate-700 dark:bg-theme-elevated dark:text-theme-fg"
                                )}
                              >
                                Tunai
                              </button>
                            </div>
                          </div>
                          {watch("metode") === "Transfer" && canPayViaBank ? (
                            <div>
                              <p className="mb-2 text-sm font-semibold">Rekening</p>
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
                                    buttonClassName="h-12 rounded-xl border-0 bg-slate-100 py-0 text-base shadow-none dark:bg-theme-elevated"
                                    optionsClassName="z-[1200] bg-white dark:bg-theme-card"
                                  />
                                )}
                              />
                              {errors.bankId ? (
                                <p className="mt-2 text-sm font-medium text-red-600">
                                  Pilih rekening bank
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                    {(!terbayar || canCancel) ? (
                      <div className="sticky bottom-0 mt-auto bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:bg-theme-card">
                        <Button
                          type="submit"
                          color="red"
                          loading={mutating}
                          loadingMessage="Menyimpan..."
                          className="h-12 w-full justify-center rounded-xl text-base font-semibold"
                        >
                          {terbayar ? "Batalkan pembayaran" : "Catat pembayaran"}
                        </Button>
                        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-slate-200 dark:bg-theme-border" />
                      </div>
                    ) : null}
                  </form>
                ) : (
                <>
                <DialogTitle
                  as="div"
                  className="flex sticky -top-6 z-50 bg-white justify-between items-center border-b border-slate-200 font-medium leading-6 text-gray-900"
                >
                  <div className="text-center">
                    <p className="text-base/7 font-semibold">Pembayaran</p>
                    {sekaligusLabel ? (
                      <p className="text-xs font-semibold text-amber-700">
                        {sekaligusLabel}
                      </p>
                    ) : null}
                  </div>
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
                  <dl>
                    <dt className="text-sm/6 font-medium">Nama</dt>
                    <dd>{val?.nama}</dd>
                  </dl>
                  <dl>
                    <dt className="text-sm/6 font-medium">No. Whatsapp</dt>
                    <dd>{val?.nomor || "-"}</dd>
                  </dl>
                  <dl>
                    <dt className="text-sm/6 font-medium">Alamat</dt>
                    <dd>{val?.alamat || "-"}</dd>
                  </dl>
                  <dl>
                    <dt className="text-sm/6 font-medium">Nominal Bayar</dt>
                    <dd>
                      {val?.pembayaran.total.toLocaleString("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      })}
                      <span className="text-slate-500"> / bulan</span>
                    </dd>
                  </dl>
                  {!terbayar && val?.pembayaran.jatuh_tempo && !petugasSatuBulan ? (
                    <Field className="grid gap-1.5">
                      <Label className="text-sm/6 font-medium">
                        Bayar untuk
                      </Label>
                      <select
                        className={cn(
                          "rounded-lg border border-slate-200 bg-white px-3 text-slate-800",
                          sheet ? "h-12 text-base" : "py-2 text-sm"
                        )}
                        {...register("bulanBayar", { valueAsNumber: true })}
                      >
                        <option value={1}>1 bulan (bulan ini saja)</option>
                        <option value={2}>2 bulan</option>
                        <option value={3}>3 bulan</option>
                        <option value={4}>4 bulan</option>
                        <option value={5}>5 bulan</option>
                        <option value={6}>6 bulan</option>
                      </select>
                      <p className="text-xs text-slate-500">
                        Ditandai lunas:{" "}
                        {prepaidBillingPeriods(
                          val.pembayaran.jatuh_tempo,
                          Number(watch("bulanBayar")) || 1
                        )
                          .map(formatBillingPeriodLabel)
                          .join(", ")}
                        . Bulan yang belum punya tagihan dibuat otomatis.
                      </p>
                    </Field>
                  ) : null}
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
                          "*:flex *:gap-1.5 *:items-center *:cursor-pointer *:rounded-lg",
                          sheet ? "flex-col gap-2 *:h-12 *:px-3 *:text-base" : "*:p-2",
                          terbayar && "*:cursor-default"
                        )}
                      >
                        {(canPayViaBank || terbayar) ? (
                          <div
                            className={cn(
                              "hover:bg-gray-100   *:cursor-pointer",
                              terbayar && "*:cursor-default"
                            )}
                            onClick={() => {
                              if (!terbayar && canPayViaBank)
                                setValue("metode", "Transfer");
                            }}
                          >
                            <input
                              type="radio"
                              disabled={terbayar || !canPayViaBank}
                              className="size-5 accent-green-600"
                              {...register("metode")}
                              value="Transfer"
                              id="mp_transfer"
                            />
                            <label htmlFor="mp_transfer">Transfer Manual</label>
                          </div>
                        ) : null}
                        <div
                          className={cn(
                            "hover:bg-gray-100   *:cursor-pointer",
                            terbayar && "*:cursor-default"
                          )}
                          onClick={() => setValue("metode", "Cash")}
                        >
                          <input
                            type="radio"
                            disabled={terbayar}
                            className="size-5 accent-green-600"
                            {...register("metode")}
                            value={"Cash"}
                            id="mp_cash"
                          />
                          <label htmlFor="mp_cash">Cash</label>
                        </div>
                      </div>
                      {!canPayViaBank && !terbayar ? (
                        <p className="text-xs text-amber-700">
                          Akun Anda hanya boleh mencatat pembayaran tunai (Cash).
                        </p>
                      ) : null}
                    </Field>
                    <Transition
                      show={
                        watch("metode") === "Transfer" &&
                        (canPayViaBank || terbayar)
                      }
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
                  <div
                    className={cn(
                      "sticky -bottom-4 mt-4 border-t bg-white border-slate-200 py-3",
                      sheet ? "flex flex-col gap-2" : "flex justify-end gap-1"
                    )}
                  >
                    {(!terbayar || canCancel) && (
                      <Button
                        type="submit"
                        color={terbayar ? "red" : "sky700"}
                        loading={mutating}
                        className={sheet ? "h-12 w-full text-base" : undefined}
                      >
                        {terbayar ? "Batalkan Pembayaran" : "Simpan"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      color="red100"
                      onClick={close}
                      className={sheet ? "h-12 w-full text-base" : undefined}
                    >
                      Tutup
                    </Button>
                  </div>
                </form>
                </>
                )}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
      <DialogDelete
        show={hapusDialog}
        setShow={setHapusDialog}
        data={val}
        closeParent={close}
        loadData={loadData}
      />
    </Transition>
  );
}
