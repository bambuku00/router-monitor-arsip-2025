import { Button } from "@/components/button";
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
import React, { useEffect, useState } from "react";
import { Input } from "@/components/input";
import { User as UserSession } from "lucia";
import { SubmitHandler, useForm } from "react-hook-form";
import { UserEditSchema as UserSchema } from "@/lib/user-types";
import toast from "react-hot-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import InputPassword from "@/components/auth/input-password";
import { z } from "zod";

type UserForm = z.infer<typeof UserSchema>;

type Props = {
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
  initialFocusRef: React.RefObject<HTMLDivElement | null>;
  user: UserSession | null | undefined;
};
const DialogUser = React.forwardRef<HTMLDivElement, Props>(
  ({ show, setShow, initialFocusRef, user }, ref) => {
    const {
      register,
      handleSubmit,
      unregister,
      setValue,
      reset,
      control,
      watch,
      formState: { errors },
    } = useForm<UserForm>({
      resolver: zodResolver(UserSchema),
    });

    const close = () => {
      setShow(false);
      setTimeout(reset, 300);
    };

    useEffect(() => {
      if (!user || !show) return;
      setValue("nama", user.nama);
      setValue("user", user.user);
      setValue("role", user.role);
    }, [show, user, setValue]);

    const [mutating, setMutating] = useState<boolean>(false);
    const submitHandler: SubmitHandler<UserForm> = async (data, e) => {
      e?.preventDefault();
      setMutating(true);
      try {
        const put = await fetch(`/api/user/${user?.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const resp = await put.json();
        if (resp.error) throw new Error(resp.error);
        if (!resp.data?.id) throw new Error("Gagal mengubah data user");
        toast.success(resp.message);
        close();
        // refresh();
      } catch (err) {
        const error = err as Error;
        console.error(error);
        toast.error(error.message);
      } finally {
        setMutating(false);
      }
    };
    return (
      <Transition show={show} as={React.Fragment}>
        <Dialog
          as="div"
          initialFocus={initialFocusRef}
          ref={ref}
          className="relative z-[1001]"
          onClose={close}
        >
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
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left text-gray-900 align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="p"
                    className="font-medium leading-6 text-gray-900 border-b border-slate-300"
                  >
                    Ubah Data User
                  </DialogTitle>
                  <form
                    className="relative"
                    onSubmit={handleSubmit(submitHandler)}
                  >
                    <div className="mt-2 rounded-md rounded-t-none pt-1">
                      <Fieldset className="grid py-2 gap-1">
                        <Field
                          className={cn(
                            "grid gap-1.5 rounded-lg",
                            errors.nama && "bg-red-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Label className="text-sm/6 font-medium">
                              Nama*
                            </Label>
                            {errors.nama ? (
                              <p className="text-xs/5 text-red-500">
                                {errors.nama.message}
                              </p>
                            ) : null}
                          </div>
                          <Input
                            {...register("nama")}
                            disabled={user?.role !== "Superadmin"}
                          />
                        </Field>
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
                          <InputPassword {...register("password")} />
                        </Field>
                      </Fieldset>
                    </div>
                    <div className="mt-4 flex justify-end gap-1">
                      <Button type="submit" color="cyan" loading={mutating}>
                        Ubah
                      </Button>
                      <Button color="red100" onClick={close}>
                        Batal
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
);
DialogUser.displayName = "DialogUser";

export default DialogUser;
