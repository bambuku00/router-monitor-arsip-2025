import { SessionLucia } from "@/lib/auth";
import { LayananClientAction, LayananClientState } from "./data";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Field,
  Fieldset,
  Label,
} from "@headlessui/react";
import { Input, InputIDR, InputRadioCheckbox } from "../input";
import toast from "react-hot-toast";
import { GrSearch } from "react-icons/gr";
import { Button } from "../button";
import { TbEdit, TbPrinter, TbTrash } from "react-icons/tb";
import { Tooltip } from "@mui/material";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { Client, ClientPerorangan, Layanan } from "@prisma/client";
import Fuse from "fuse.js";
import { FaCheck } from "react-icons/fa6";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  LayananOptionalDefaultsSchema as LayananSchema,
  LayananOptionalDefaults as LayananType,
} from "@/prisma/generated/zod";

type Props = {
  user: SessionLucia["user"];
  layananState: LayananClientState;
  layananDispatch: React.Dispatch<LayananClientAction>;
};

type ClientLayanan = Client & {
  perorangan: ClientPerorangan[];
  layanan: Layanan[];
  nomor: string | null;
  alamat: string | null;
};

type EditLayananAction =
  | { action: "open"; data: Layanan }
  | { action: "close" }
  | { action: "data"; data: Layanan };

export default function DialogClientLayanan({
  user,
  layananState,
  layananDispatch,
}: Props) {
  const tutup = () => {
    layananDispatch({ action: "close" });
    setTimeout(() => layananDispatch({ action: "data", data: undefined }), 300);
  };

  const [add, setAdd] = useState<boolean>(false);
  const [edit, editDispatch] = useReducer(
    (
      state: { modal: boolean; data?: Layanan | null },
      action: EditLayananAction
    ) => {
      switch (action.action) {
        case "open":
          return { ...state, modal: true, data: action.data };
        case "close":
          return { ...state, modal: false };
        case "data":
          return { ...state, data: action.data };
        default:
          return state;
      }
    },
    {
      modal: false,
      data: null,
    }
  );

  const [querySearch, setQuerySearch] = useState<string>("");

  const paginationState = {
    page: 1,
    totalPages: 1,
  };
  const paginationActs = (
    state: typeof paginationState,
    action: { type: "setPage" | "setTotalPages"; data: number }
  ) => {
    switch (action.type) {
      case "setPage": {
        return {
          ...state,
          page: action.data,
        };
      }
      case "setTotalPages": {
        return {
          ...state,
          totalPages: action.data,
        };
      }
      default: {
        return state;
      }
    }
  };
  const [pagination, paginationDispatch] = useReducer(
    paginationActs,
    paginationState
  );
  const deferredQuery = useDeferredValue(querySearch);

  const [client, setClient] = useState<ClientLayanan | undefined | null>();

  const loadLayanan = useCallback(async () => {
    try {
      const resp = await fetch(`/api/client/${layananState.data?.id}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json || "Terjadi kesalahan pada server");
      setClient(json.data);
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
      console.error(error);
    }
  }, [layananState.data?.id]);

  useEffect(() => {
    if (!layananState.modal) return;
    if (!layananState.data) return setClient(null);
    if (client?.id !== layananState.data.id) {
      loadLayanan();
    }
  }, [layananState.modal, layananState.data, client?.id, loadLayanan]);

  const filteredData = useMemo(() => {
    if (!client || !client.layanan) return [];
    const fuse = new Fuse(client.layanan, {
      keys: ["nama", "parent.nama", "user"],
      threshold: 0.3,
    });
    const data =
      deferredQuery === ""
        ? client?.layanan || []
        : fuse.search(deferredQuery).map((val) => val.item);
    const totalPages = Math.ceil((data?.length || 1) / 10);
    paginationDispatch({ type: "setTotalPages", data: 4 });
    return data?.slice((pagination.page - 1) * 10, pagination.page * 10);
  }, [client, pagination.page, deferredQuery]);

  return (
    <>
      <Dialog
        open={layananState.modal}
        as="div"
        className="relative z-[1001]"
        onClose={tutup}
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black bg-opacity-25 duration-300 ease-out data-[closed]:transform-[scale(95%)] data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex h-dvh items-center justify-end overflow-hidden text-center">
            <DialogPanel
              transition
              className="h-full w-full max-w-5xl transform overflow-y-auto rounded bg-white p-6 pb-4 text-left text-gray-900 align-middle shadow-xl duration-300 ease-out data-[closed]:transform-[scale(95%)] data-[closed]:opacity-0"
            >
              <DialogTitle
                as="div"
                className="flex sticky -top-6 z-50 bg-white justify-between items-center border-b border-slate-200 font-medium leading-6 text-gray-900"
              >
                <p>Layanan Client</p>
              </DialogTitle>
              <div className="mt-4 grid grid-cols-2 gap-4 w-full relative">
                <div className="relative max-w-sm flex gap-2">
                  <label htmlFor="search" className="sr-only">
                    Cari
                  </label>
                  <div className="flex-1">
                    <div
                      className="pointer-events-none hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 pl-2"
                      aria-hidden="true"
                    >
                      <GrSearch
                        className="mr-3 size-4 text-gray-400"
                        aria-hidden="true"
                      />
                    </div>
                    <Input
                      type="text"
                      name="search"
                      id="search"
                      className="h-8 block w-full text-sm sm:pl-8 px-2 focus:outline-none"
                      placeholder="Cari"
                      spellCheck={false}
                      value={querySearch}
                      onChange={(e) => setQuerySearch(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  className="w-fit justify-self-end"
                  onClick={() => setAdd(true)}
                >
                  Tambah Layanan
                </Button>
              </div>
              <div
                className={cn(
                  "mt-4 w-full overflow-x-auto rounded text-sm shadow"
                )}
              >
                <table className="min-w-full">
                  <thead>
                    <tr className="divide-x divide-slate-50 bg-slate-300/70 *:px-4 *:py-1">
                      <td>No.</td>
                      <td>Layanan</td>
                      <td>Registrasi</td>
                      <td>
                        <p>Kapasitas/</p>
                        <p>Kuantitas</p>
                      </td>
                      <td>Bulanan</td>
                      <td>Tgl.</td>
                      <td>Tgl. Akhir</td>
                      <td>Tgl. Input</td>
                      <td className="text-center">*</td>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData && filteredData.length > 0 ? (
                      filteredData.map((val, idx) => {
                        const numberPage =
                          pagination.page <= 1 ? 0 : (pagination.page - 1) * 10;
                        const nomor = idx + 1 + numberPage;
                        return (
                          <tr
                            className="bg-slate-50/80 hover:text-sky-600"
                            key={idx}
                          >
                            <td className="whitespace-pre-wrap px-4 py-2">
                              {nomor + "."}
                            </td>
                            <td className="whitespace-pre-wrap px-4 py-2">
                              {val.nama}
                            </td>
                            <td className="whitespace-pre-wrap px-4 py-2">
                              {val.registrasi.toLocaleString("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                maximumFractionDigits: 0,
                              })}
                            </td>
                            <td className="whitespace-pre-wrap px-4 py-2">
                              {val.kapasitas}
                            </td>
                            <td className="whitespace-pre-wrap px-4 py-2">
                              <div className="relative">
                                {val.bulanan.toLocaleString("id-ID", {
                                  style: "currency",
                                  currency: "IDR",
                                  maximumFractionDigits: 0,
                                })}
                                <p
                                  className={cn(
                                    "absolute -top-3 -right-2 text-xs text-green-500",
                                    val.incVat ? "visible" : "invisible"
                                  )}
                                >
                                  PPN
                                </p>
                              </div>
                            </td>
                            <td className="whitespace-pre-wrap px-4 py-2">
                              {new Date(val.tgl).toLocaleDateString("id-ID")}
                            </td>
                            <td className="whitespace-pre-wrap px-4 py-2">
                              {new Date(
                                new Date(val.tgl).setMonth(
                                  new Date(val.tgl).getMonth() + val.kontrak
                                )
                              ).toLocaleDateString("id-ID")}
                            </td>
                            <td className="whitespace-pre-wrap px-4 py-2">
                              {new Date(val.created).toLocaleDateString(
                                "id-ID"
                              )}
                            </td>
                            <td className="whitespace-pre-wrap px-4 py-2">
                              <div className="max-w-20 flex flex-wrap gap-2 justify-center">
                                <Tooltip title="Ubah">
                                  <Button
                                    color="slatesky"
                                    type="button"
                                    className="rounded"
                                    onClick={() =>
                                      editDispatch({
                                        action: "open",
                                        data: val,
                                      })
                                    }
                                  >
                                    <TbEdit />
                                  </Button>
                                </Tooltip>
                                <Tooltip title="Cetak">
                                  <Button
                                    color="slatesky"
                                    type="button"
                                    className="rounded"
                                    onClick={() => toast.success("Stay Tune")}
                                  >
                                    <TbPrinter />
                                  </Button>
                                </Tooltip>
                                <Tooltip title="Hapus">
                                  <Button
                                    color="slatesky"
                                    type="button"
                                    className="rounded"
                                    onClick={
                                      () => false
                                      //  editUserDispatch({
                                      //    action: "open",
                                      //    data: val,
                                      //  })
                                    }
                                  >
                                    <TbTrash />
                                  </Button>
                                </Tooltip>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr className="bg-slate-50/80">
                        <td colSpan={10}>
                          <p className="px-4 py-2 text-center">
                            Tidak ada data
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="sticky -bottom-4 mt-4 border-t gap-1 bg-white border-slate-200 py-2 flex justify-end">
                <Button color="red100" onClick={tutup}>
                  Tutup
                </Button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
      <DialogFormLayanan
        client={client as ClientLayanan}
        add={add}
        setAdd={setAdd}
        edit={edit}
        editDispatch={editDispatch}
        loadLayanan={loadLayanan}
      />
    </>
  );
}

const DialogFormLayanan = ({
  client,
  add,
  setAdd,
  edit,
  editDispatch,
  loadLayanan,
}: {
  client: ClientLayanan;
  add: boolean;
  setAdd: React.Dispatch<React.SetStateAction<boolean>>;
  edit: { modal: boolean; data?: Layanan | null };
  editDispatch: React.Dispatch<EditLayananAction>;
  loadLayanan: () => void;
}) => {
  const tutup = () => {
    setAdd(false);
    editDispatch({ action: "close" });
    setTimeout(reset, 300);
  };

  const open = useMemo(() => add || edit.modal, [add, edit]);
  const val = useMemo(() => edit.data, [edit]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    trigger,
    control,
    watch,
    formState: { errors },
  } = useForm<LayananType>({
    resolver: zodResolver(LayananSchema),
    defaultValues: {
      incVat: false,
    },
  });

  useEffect(() => {
    console.log(errors);
  }, [errors]);

  const [alamatSama, setAlamatSama] = useState<boolean>(false);
  const handleChangeAlamat = (value: boolean) => {
    if (value) {
      setValue("alamat_layanan", client.alamat);
      setAlamatSama(true);
    } else {
      setValue("alamat_layanan", "");
      setAlamatSama(false);
    }
    trigger("alamat_layanan");
  };

  const handleOnChangeAlamat = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    handleChangeAlamat(checked);
  };

  const handleWrapperClickAlamat = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleChangeAlamat(!alamatSama);
  };

  const [mutating, setMutating] = useState<boolean>(false);
  const submitHandler: SubmitHandler<LayananType> = async (data, e) => {
    e?.preventDefault();
    setMutating(true);
    try {
      if (!val?.id) {
        const post = await fetch("/api/client/layanan", {
          method: "POST",
          body: JSON.stringify({
            ...data,
            clientId: client.id,
            alamat_layanan: !!watch("alamat_layanan")
              ? watch("alamat_layanan")
              : client.alamat,
          }),
        });
        const resp = await post.json();
        if (!resp.data?.id) throw new Error(resp);
        toast.success(resp.message);
      } else {
        const put = await fetch(`/api/client/layanan/${data.id}`, {
          method: "PUT",
          body: JSON.stringify({
            ...data,
            clientId: client.id,
            alamat_layanan: !!watch("alamat_layanan")
              ? watch("alamat_layanan")
              : client.alamat,
          }),
        });
        const resp = await put.json();
        if (!resp.data?.id) throw new Error(resp);
        toast.success(resp.message);
      }
      tutup();
      setTimeout(loadLayanan, 500);
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
      console.error(error.message);
    } finally {
      setMutating(false);
    }
  };

  return (
    <Dialog open={open} as="div" className="relative z-[1002]" onClose={tutup}>
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black bg-opacity-25 duration-300 ease-out data-[closed]:transform-[scale(95%)] data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <DialogPanel
            transition
            className="flex flex-col gap-4 w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 py-4 text-left text-gray-900 align-middle shadow-xl duration-300 ease-out data-[closed]:transform-[scale(95%)] data-[closed]:opacity-0"
          >
            <DialogTitle
              as="div"
              className="flex sticky -top-6 z-50 bg-white justify-between items-center border-b border-slate-200 font-medium leading-6 text-gray-900"
            >
              <p>Tambah Layanan</p>
            </DialogTitle>
            <form className="relative" onSubmit={handleSubmit(submitHandler)}>
              <Fieldset className="grid sm:grid-cols-2 gap-2.5">
                <Field
                  className={cn(
                    "grid gap-1.5 rounded-lg",
                    errors.nama && "bg-red-200"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <Label className="text-sm/6 font-medium">
                      Pilihan/Nama Layanan*
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
                    errors.tgl && "bg-red-200"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <Label className="text-sm/6 font-medium">Tanggal*</Label>
                    {errors.tgl ? (
                      <p className="text-xs/5 text-red-500">
                        {errors.tgl.message}
                      </p>
                    ) : null}
                  </div>
                  <Input type="date" {...register("tgl")} />
                </Field>
                <Field
                  className={cn(
                    "grid gap-1.5 rounded-lg",
                    errors.kapasitas && "bg-red-200"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <Label className="text-sm/6 font-medium">
                      Kapasitas/Kuantitas*
                    </Label>
                    {errors.kapasitas ? (
                      <p className="text-xs/5 text-red-500">
                        {errors.kapasitas.message}
                      </p>
                    ) : null}
                  </div>
                  <Input {...register("kapasitas")} />
                </Field>
                <Field
                  className={cn(
                    "grid gap-1.5 rounded-lg",
                    errors.registrasi && "bg-red-200"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <Label className="text-sm/6 font-medium">
                      Biaya Registrasi*
                    </Label>
                    {errors.registrasi ? (
                      <p className="text-xs/5 text-red-500">
                        {errors.registrasi.message}
                      </p>
                    ) : null}
                  </div>
                  <Controller
                    control={control}
                    name="registrasi"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <InputIDR
                        value={value || ""}
                        onBlur={onBlur}
                        step={1000}
                        onValueChange={(val) => onChange(parseFloat(val || ""))}
                      />
                    )}
                  />
                </Field>
                <Field
                  className={cn(
                    "grid gap-1.5 rounded-lg",
                    errors.bulanan && "bg-red-200"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <Label className="text-sm/6 font-medium">
                      Biaya Bulanan*
                    </Label>
                    {errors.bulanan ? (
                      <p className="text-xs/5 text-red-500">
                        {errors.bulanan.message}
                      </p>
                    ) : null}
                    <Controller
                      control={control}
                      name="incVat"
                      render={({ field: { value, onChange } }) => {
                        const handleOnChange = (
                          e: React.ChangeEvent<HTMLInputElement>
                        ) => {
                          const checked = e.target.checked;
                          onChange(checked);
                        };

                        const handleWrapperClick = (e: React.MouseEvent) => {
                          e.stopPropagation();
                          onChange(!value);
                        };
                        return (
                          <InputRadioCheckbox
                            label="Termasuk PPN"
                            id="incVat"
                            checked={value || false}
                            onChange={handleOnChange}
                            type="checkbox"
                            className="size-3 mr-2"
                            wrapperClassName={cn(
                              "py-1 gap-0 h-fit self-end divide-x divide-slate-300 border border-slate-300",
                              errors.bulanan && "bg-slate-100"
                            )}
                            labelClassName="text-[10px]/[12px] pl-2 select-none"
                            wrapperOnClick={handleWrapperClick}
                          />
                        );
                      }}
                    />
                  </div>
                  <Controller
                    control={control}
                    name="bulanan"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <InputIDR
                        value={value || ""}
                        onBlur={onBlur}
                        step={1000}
                        onValueChange={(val) => onChange(parseFloat(val || ""))}
                      />
                    )}
                  />
                </Field>
                <Field
                  className={cn(
                    "grid gap-1.5 rounded-lg",
                    errors.kontrak && "bg-red-200"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <Label className="text-sm/6 font-medium">Kontrak*</Label>
                    {errors.kontrak ? (
                      <p className="text-xs/5 text-red-500">
                        {errors.kontrak.message}
                      </p>
                    ) : null}
                  </div>
                  <Input
                    type="number"
                    placeholder="Bulan"
                    {...register("kontrak", { valueAsNumber: true })}
                  />
                </Field>
                <Field className="relative sm:col-span-2">
                  <div
                    className={cn(
                      "grid gap-1.5 rounded-lg",
                      errors.alamat_layanan && "bg-red-200"
                    )}
                  >
                    <div className="flex justify-between items-center">
                      <Label className="text-sm/6 font-medium">Alamat</Label>
                      {errors.alamat_layanan ? (
                        <p className="text-xs/5 text-red-500">
                          {errors.alamat_layanan.message}
                        </p>
                      ) : null}
                    </div>
                    <InputRadioCheckbox
                      label="Sama dengan alamat client"
                      id="alamatSama"
                      checked={alamatSama}
                      onChange={handleOnChangeAlamat}
                      type="checkbox"
                      className="size-3 mr-2"
                      wrapperClassName={cn(
                        "absolute top-0 right-0 py-1 gap-0 h-fit self-end divide-x divide-slate-300 border border-slate-300"
                      )}
                      labelClassName="text-[10px]/[12px] pl-2 select-none"
                      wrapperOnClick={handleWrapperClickAlamat}
                    />

                    <Input
                      placeholder="Alamat"
                      disabled={alamatSama}
                      {...register("alamat_layanan")}
                    />
                  </div>
                </Field>
              </Fieldset>
              <div className="sticky -bottom-4 mt-4 border-t gap-1 bg-white border-slate-200 py-2 flex justify-end">
                <Button type="submit" disabled={mutating} color="cyan">
                  Simpan
                </Button>
                <Button color="red" onClick={tutup}>
                  Tutup
                </Button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
};
