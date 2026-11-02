"use client";

import InputPassword from "@/components/auth/input-password";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { SessionLucia } from "@/lib/auth";
import {
  UserOptionalDefaults,
  UserOptionalDefaultsSchema,
} from "@/prisma/generated/zod";
import { Field, Fieldset, Description, Legend } from "@headlessui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import Logo from "@/public/logo.png";
import Image from "next/image";
import { FaRegEye, FaRegEyeSlash, FaUserAlt } from "react-icons/fa";
import { FaLock } from "react-icons/fa6";
import Link from "next/link";
import AuthInfoLinks from "@/components/auth/info-links";
import { login } from "@/lib/server-actions/auth-actions";
import { resolvePostLoginPath } from "@/lib/staff-menu-access";
import ThemeToggle from "@/components/theme-toggle";

const UserSchema = UserOptionalDefaultsSchema.pick({
  user: true,
  password: true,
});
type User = Pick<UserOptionalDefaults, "user" | "password">;
export default function FormLogin({ session: _session }: { session?: SessionLucia }) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<User>({
    resolver: zodResolver(UserSchema),
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
  const [visiblePass, setVisiblePass] = useState<boolean>(false);

  const [mutating, setMutating] = useState<boolean>(false);
  const submitHandler: SubmitHandler<User> = async (data, e) => {
    e?.preventDefault();
    setMutating(true);
    try {
      const post = await login(data);
      if (post.error) throw post.error;
      if (!post.user) throw new Error("Terjadi kesalahan pada server");

      toast.success("Berhasil masuk");

      const target = resolvePostLoginPath({
        role: post.user.role,
        id: post.user.id,
        parentId: post.user.parentId ?? null,
        staffMenuKeys: post.user.staffMenuKeys,
      });

      // Muat ulang penuh agar layout (home) & sesi cookie terbaca — hindari layar putih setelah login.
      window.location.assign(target);
      return;
    } catch (error) {
      toast.error(
        typeof error === "string" && error.trim()
          ? error
          : "Terjadi kesalahan pada server"
      );
    } finally {
      setMutating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="relative flex w-full flex-1 flex-col justify-center px-6 py-4">
      <div className="absolute top-0 right-0">
        <ThemeToggle />
      </div>
      <Fieldset className="mx-auto flex w-full max-w-none flex-col justify-center md:max-w-xs">
        <div className="my-5 flex justify-center">
          <Image
            src={Logo}
            alt="WINET"
            className="h-auto w-48 md:w-36"
            loading="eager"
            decoding="sync"
            priority
          />
        </div>
        <p className="mb-6 text-center text-2xl font-semibold text-slate-800 dark:text-theme-fg md:text-sm md:font-medium">
          Masuk
        </p>
        {/* <Legend className="font-semibold text-center mb-2">
          Router Monitoring
        </Legend> */}
        <Field className="mb-8 grid gap-3 md:gap-2">
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-theme-fg md:hidden"
              htmlFor="username"
            >
              Username
            </label>
            <div className="relative">
              <label
                className="absolute left-3 top-1.5 hidden text-xs/tight text-slate-600 dark:text-theme-fg-muted md:block"
                htmlFor="username"
              >
                Username
              </label>
              <FaUserAlt className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-600 md:bottom-3 md:left-3 md:top-auto md:size-2.5 md:translate-y-0" />
              <Input
                className="h-14 rounded-xl bg-slate-300/90 py-3 pl-11 text-base text-slate-900 placeholder:text-slate-600/60 dark:bg-theme-elevated dark:text-theme-fg dark:placeholder:text-theme-fg-muted md:h-auto md:rounded-lg md:py-1.5 md:pl-8 md:pt-6 md:text-sm"
                id="username"
                {...register("user")}
                autoComplete="username"
              />
            </div>
          </div>
          {errors.user?.message ? (
            <p className="text-xs text-red-700 dark:text-red-400" role="alert">
              {errors.user.message === "Required"
                ? "Username wajib diisi."
                : errors.user.message}
            </p>
          ) : null}
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-theme-fg md:hidden"
              htmlFor="password"
            >
              Password
            </label>
            <div className="relative">
              <label
                className="absolute left-3 top-1.5 hidden text-xs/tight text-slate-600 dark:text-theme-fg-muted md:block"
                htmlFor="password"
              >
                Password
              </label>
              <FaLock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-600 md:bottom-3 md:left-3 md:top-auto md:size-2.5 md:translate-y-0" />
              <Input
                className="h-14 rounded-xl bg-slate-300/90 py-3 pl-11 text-base text-slate-900 placeholder:text-slate-600/60 dark:bg-theme-elevated dark:text-theme-fg dark:placeholder:text-theme-fg-muted md:h-auto md:rounded-lg md:py-1.5 md:pl-8 md:pt-6 md:text-sm"
                id="password"
                type={visiblePass ? "text" : "password"}
                {...register("password")}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-600 dark:text-theme-fg-muted md:right-3 md:p-0"
                aria-label={visiblePass ? "Sembunyikan password" : "Tampilkan password"}
                aria-pressed={visiblePass}
                onClick={() => setVisiblePass((current) => !current)}
              >
                {visiblePass ? (
                  <FaRegEyeSlash className="size-5 md:size-3.5" />
                ) : (
                  <FaRegEye className="size-5 md:size-3.5" />
                )}
              </button>
            </div>
          </div>
          {errors.password?.message ? (
            <p className="text-xs text-red-700 dark:text-red-400" role="alert">
              {errors.password.message === "Required"
                ? "Password wajib diisi."
                : errors.password.message}
            </p>
          ) : null}
        </Field>
        <Button
          type="submit"
          color="red"
          className="min-h-12 justify-center rounded-xl bg-red-500 py-3 text-base md:min-h-0 md:rounded md:py-1 md:text-sm"
          loading={mutating}
        >
          Masuk
        </Button>
        <div className="mt-3 text-base md:mt-0.5 md:text-xs">
          <span>Belum memiliki akun? </span>
          <span>
            <Link href="/register" className="font-semibold text-slate-800 underline-offset-2 hover:underline dark:text-theme-fg">
              Daftar disini.
            </Link>
          </span>
        </div>
        <div className="max-md:[&_a]:text-base max-md:[&_a]:leading-6">
          <AuthInfoLinks />
        </div>
      </Fieldset>
    </form>
  );
}
