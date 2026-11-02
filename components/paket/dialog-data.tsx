import { Input, InputIDR } from "@/components/input";
import { EditAction, EditState } from "@/lib/paket-types";
import {
  formatKapasitasMbps,
  parseKapasitasInputToMbps,
} from "@/lib/mikrotik-paket";
import {
  derivePaketHargaFromNominalInput,
  paketBreakdownFromHargaDpp,
} from "@/lib/pembayaran-tax";
import { ppnFromPaketNominal } from "@/lib/paket-persist";
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
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Button } from "../button";

import { z } from "zod";

const PaketFormSchema = z.object({
  id: z.number().optional(),
  nama: z.string().min(1),
  userId: z.number(),
  harga: z.number().nonnegative(),
});
type PaketForm = z.infer<typeof PaketFormSchema>;

type Props = {
  add: boolean;
  setAdd: React.Dispatch<React.SetStateAction<boolean>>;
  edit: EditState;
  editDispatch: React.Dispatch<EditAction>;
  userId: number | undefined;
  ppn: number | null | undefined;
};
export default function DialogData({
  add,
  setAdd,
  edit,
  editDispatch,
  userId,
  ppn,
}: Props) {
  const ppnPercent = ppn ?? 11;
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<PaketForm>({
    resolver: zodResolver(PaketFormSchema),
  });

  const [kapasitasInput, setKapasitasInput] = useState("");
  const [kapasitasError, setKapasitasError] = useState<string | null>(null);

  const { refresh } = useRouter();
  const show = useMemo(() => {
    return add || edit.modal;
  }, [add, edit]);
  const close = () => {
    setTimeout(reset, 300);
    setVat("");
    setNominal("");
    setKapasitasInput("");
    setKapasitasError(null);
    if (!add) {
      editDispatch({ action: "close" });
      editDispatch({ action: "data", data: undefined });
    } else {
      setAdd(false);
    }
  };
  const val = useMemo(() => edit.data, [edit]);
  const editPaketId = edit.modal && val ? val.id : null;
  const [judulTemp, setJudulTemp] = useState<string>("");
  const judul: "Tambah Paket" | string = useMemo(() => {
    if (!edit.modal && !add) return judulTemp;
    setJudulTemp(edit.modal ? `Paket ${val?.nama}` : "Tambah Paket");
    return edit.modal ? `Paket ${val?.nama}` : "Tambah Paket";
  }, [add, edit, val, judulTemp]);

  const [vat, setVat] = useState<string | number>("");
  const [nominal, setNominal] = useState<string | number>("");
  const skipHargaSyncRef = useRef(false);

  const syncPriceDisplay = useCallback(
    (hargaVal: number) => {
      const { harga, ppn, nominal } = paketBreakdownFromHargaDpp(
        hargaVal,
        ppnPercent
      );
      setValue("harga", harga);
      setVat(String(ppn));
      setNominal(String(nominal));
    },
    [ppnPercent, setValue]
  );

  useEffect(() => {
    if (!show) return;

    if (editPaketId != null && val) {
      reset({
        id: val.id,
        nama: val.nama,
        harga: val.harga,
        userId: userId!,
      });
      setKapasitasInput(formatKapasitasMbps(val.kapasitas).replace(/ Mbps$/, ""));
      setKapasitasError(null);
      if (val.nominalPembayaran != null) {
        setValue("harga", val.harga ?? 0);
        setNominal(String(val.nominalPembayaran));
        setVat(String(ppnFromPaketNominal(val.nominalPembayaran, val.harga ?? 0)));
      } else {
        syncPriceDisplay(val.harga ?? 0);
      }
      return;
    }

    if (add) {
      reset({
        userId: userId!,
        nama: "",
        harga: 0,
      });
      setKapasitasInput("");
      setKapasitasError(null);
      syncPriceDisplay(0);
    }
  }, [
    show,
    editPaketId,
    add,
    val,
    userId,
    reset,
    syncPriceDisplay,
  ]);

  const handleHargaChange = useCallback(
    (val: string | undefined) => {
      if (skipHargaSyncRef.current) return;
      if (!val) {
        setValue("harga", 0);
        setVat("");
        setNominal("");
        return;
      }
      const price = Math.round(parseFloat(val));
      if (val.length < 5) {
        setValue("harga", price);
        return;
      }
      const breakdown = paketBreakdownFromHargaDpp(price, ppnPercent);
      setValue("harga", breakdown.harga);
      setVat(String(breakdown.ppn));
      setNominal(String(breakdown.nominal));
    },
    [ppnPercent, setValue]
  );

  const handleNominalChange = useCallback(
    (val: string | undefined) => {
      if (!val) {
        setNominal("");
        return;
      }
      const bruto = Math.round(parseFloat(val));
      setNominal(bruto);
      if (val.length < 5) return;

      const breakdown = derivePaketHargaFromNominalInput(bruto, ppnPercent);
      skipHargaSyncRef.current = true;
      setValue("harga", breakdown.harga);
      setVat(String(breakdown.ppn));
      setNominal(String(breakdown.nominal));
      queueMicrotask(() => {
        skipHargaSyncRef.current = false;
      });
    },
    [ppnPercent, setValue]
  );

  const [mutating, setMutating] = useState<boolean>(false);
  const submitHandler: SubmitHandler<PaketForm> = async (data, e) => {
    e?.preventDefault();
    const kapasitas = parseKapasitasInputToMbps(kapasitasInput);
    if (kapasitas === null) {
      setKapasitasError("Format tidak valid (contoh: 10, 10M, 512k)");
      return;
    }
    setKapasitasError(null);
    setMutating(true);
    try {
      const nominalVal = Math.round(Number(nominal) || 0);
      const payload = {
        nama: data.nama,
        kapasitas,
        userId: data.userId,
        nominalPembayaran: nominalVal,
        ...(data.id != null ? { id: data.id } : {}),
      };
      if (!val) {
        const post = await fetch("/api/paket", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const resp = await post.json();
        if (!resp.data?.id) throw new Error(resp);
        toast.success(resp.message);
      } else {
        const put = await fetch(`/api/paket/${data.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        const resp = await put.json();
        if (!resp.data?.id) throw new Error(resp);
        toast.success(resp.message);
      }
      close();
      refresh();
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
      // Error already shown to user via toast
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
                  <p>{judul}</p>
                </DialogTitle>
                <form
                  className="relative"
                  onSubmit={handleSubmit(submitHandler)}
                >
                  <Fieldset className="grid grid-cols-2 gap-2 py-2">
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
                        kapasitasError && "bg-red-200"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">
                          Kapasitas*
                        </Label>
                        {kapasitasError ? (
                          <p className="text-xs/5 text-red-500">
                            {kapasitasError}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center divide-x divide-slate-300">
                        <Input
                          type="text"
                          inputMode="text"
                          autoComplete="off"
                          placeholder="10 atau 10M"
                          className="rounded-r-none flex-1"
                          value={kapasitasInput}
                          onChange={(e) => {
                            setKapasitasInput(e.target.value);
                            if (kapasitasError) setKapasitasError(null);
                          }}
                        />
                        <div className="rounded-r-lg text-xs px-1.5 flex items-center h-full bg-slate-200 whitespace-nowrap">
                          Mbps
                        </div>
                      </div>
                    </Field>
                    <div className={cn("grid md:grid-cols-3 col-span-2 gap-2")}>
                      <Field
                        className={cn(
                          "grid gap-1.5 rounded-lg",
                          errors.harga && "bg-red-200"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <Label className="text-sm/6 font-medium">
                            Harga Paket*
                          </Label>
                          {errors.harga ? (
                            <p className="text-xs/5 text-red-500">
                              {errors.harga.message}
                            </p>
                          ) : null}
                        </div>
                        <Controller
                          control={control}
                          name="harga"
                          render={({ field: { value, onBlur } }) => (
                            <InputIDR
                              key={`harga-${editPaketId ?? (add ? "add" : "none")}`}
                              value={value ?? 0}
                              onBlur={onBlur}
                              step={1000}
                              onValueChange={handleHargaChange}
                            />
                          )}
                        />
                      </Field>
                      <Field className={cn("grid gap-1.5 rounded-lg")}>
                        <div className="flex justify-between items-center">
                          <Label className="text-sm/6 font-medium">PPN</Label>
                        </div>
                        <InputIDR disabled value={vat || ""} />
                      </Field>
                      <Field className={cn("grid gap-1.5 relative rounded-lg")}>
                        <div className="flex justify-between items-center">
                          <Label className="text-sm/6 font-medium">
                            Nominal Pembayaran
                          </Label>
                        </div>
                        <InputIDR
                          key={`nominal-${editPaketId ?? (add ? "add" : "none")}`}
                          value={nominal || ""}
                          step={1000}
                          onValueChange={handleNominalChange}
                        />
                        <div className="absolute -bottom-5 left-1">
                          <p className="text-[11px]/4">
                            *harga total bisa langsung di input disini
                          </p>
                        </div>
                      </Field>
                    </div>
                  </Fieldset>
                  <div className="sticky -bottom-4 mt-4 border-t gap-1 bg-white border-slate-200 py-2 flex">
                    <Button
                      loading={mutating}
                      color={judul === "Tambah Paket" ? "green100" : "sky700"}
                      type="submit"
                    >
                      {judul === "Tambah Paket" ? "Simpan" : "Ubah"}
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
