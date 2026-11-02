import { Input, InputIDR } from "@/components/input";
import {
  BankOptionalDefaults as Bank,
  BankOptionalDefaultsSchema as BankSchema,
} from "@/prisma/generated/zod";
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
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Button } from "../button";
import { EditAction, EditState } from "./data-bank";

type Props = {
  add: boolean;
  setAdd: React.Dispatch<React.SetStateAction<boolean>>;
  edit: EditState;
  editDispatch: React.Dispatch<EditAction>;
  userId: number | undefined;
};
export default function DialogData({
  add,
  setAdd,
  edit,
  editDispatch,
  userId,
}: Props) {
  const {
    register,
    handleSubmit,
    unregister,
    setValue,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<Bank>({
    resolver: zodResolver(BankSchema),
    defaultValues: { hideFromUnpaidInvoice: false },
  });

  const { refresh } = useRouter();
  const show = useMemo(() => {
    return add || edit.modal;
  }, [add, edit]);
  const close = () => {
    setTimeout(reset, 300);
    if (!add) {
      editDispatch({ action: "close" });
      editDispatch({ action: "data", data: undefined });
      // setTimeout(() => editDispatch({ action: "data", data: undefined }), 300);
    } else {
      setAdd(false);
    }
  };
  const val = useMemo(() => edit.data, [edit]);
  const [judulTemp, setJudulTemp] = useState<string>("");
  const judul: "Tambah Bank" | string = useMemo(() => {
    if (!edit.modal && !add) return judulTemp;
    setJudulTemp(edit.modal ? `Bank ${val?.nama}` : "Tambah Bank");
    return edit.modal ? `Bank ${val?.nama}` : "Tambah Bank";
  }, [add, edit, val, judulTemp]);

  useEffect(() => {
    if (!add && !edit.modal) return;
    setValue("userId", userId!);
    if (add) setValue("hideFromUnpaidInvoice", false);

    if (!edit.data || !edit.modal) return;
    setValue("id", val?.id!);
    setValue("nama", val?.nama!);
    setValue("bank", val?.bank!);
    setValue("norek", val?.norek!);
    setValue("hideFromUnpaidInvoice", val?.hideFromUnpaidInvoice === true);
  }, [add, edit, val, userId, unregister, setValue]);

  const [mutating, setMutating] = useState<boolean>(false);
  const submitHandler: SubmitHandler<Bank> = async (data, e) => {
    e?.preventDefault();
    setMutating(true);
    try {
      if (!val) {
        const post = await fetch("/api/bank", {
          method: "POST",
          body: JSON.stringify(data),
        });
        const resp = await post.json();
        if (!resp.data?.id) throw new Error(resp);
        toast.success(resp.message);
      } else {
        const put = await fetch(`/api/bank/${data.id}`, {
          method: "PUT",
          body: JSON.stringify(data),
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
                        errors.bank && "bg-red-200"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">Bank*</Label>
                        {errors.bank ? (
                          <p className="text-xs/5 text-red-500">
                            {errors.bank.message}
                          </p>
                        ) : null}
                      </div>
                      <Input {...register("bank")} />
                    </Field>
                    <Field
                      className={cn(
                        "grid gap-1.5 rounded-lg",
                        errors.nama && "bg-red-200"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">
                          Atas Nama*
                        </Label>
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
                        errors.norek && "bg-red-200"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <Label className="text-sm/6 font-medium">
                          No. Rekening*
                        </Label>
                        {errors.norek ? (
                          <p className="text-xs/5 text-red-500">
                            {errors.norek.message}
                          </p>
                        ) : null}
                      </div>
                      <Input {...register("norek")} />
                    </Field>
                    <Field className="col-span-2 grid gap-1.5 rounded-lg">
                      <label className="flex items-start gap-2 text-sm/6">
                        <input
                          type="checkbox"
                          className="mt-1 size-4"
                          {...register("hideFromUnpaidInvoice")}
                        />
                        <span>
                          <span className="font-medium">
                            Jangan tampilkan di invoice belum lunas
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            Rekening ini tidak masuk daftar cara bayar invoice yang belum lunas.
                            Invoice yang sudah lunas tetap menampilkan rekening tujuan. Di halaman
                            pembayaran dan pembukuan rekening ini tetap ada.
                          </span>
                        </span>
                      </label>
                    </Field>
                  </Fieldset>
                  <div className="sticky -bottom-4 mt-4 border-t gap-1 bg-white border-slate-200 py-2 flex">
                    <Button
                      loading={mutating}
                      color={judul === "Tambah Bank" ? "green100" : "sky700"}
                      type="submit"
                    >
                      {judul === "Tambah Bank" ? "Simpan" : "Ubah"}
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
