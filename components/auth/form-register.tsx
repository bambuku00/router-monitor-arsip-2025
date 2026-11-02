"use client";

import { Button } from "@/components/button";
import { Input, InputDropzoneFile, InputPhone } from "@/components/input";
import { SessionLucia } from "@/lib/auth";
import sendRegister from "@/lib/server-actions/wa/send-register";
import { UserRegister, UserRegisterSchema } from "@/lib/user-types";
import Logo from "@/public/logo.png";
import { Field, Fieldset, Label } from "@headlessui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import AuthInfoLinks from "@/components/auth/info-links";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  FaExclamationCircle,
  FaRegEye,
  FaRegEyeSlash,
  FaRegIdCard,
  FaRegUserCircle,
  FaUserAlt,
} from "react-icons/fa";
import { FaLock } from "react-icons/fa6";
import { GoHomeFill } from "react-icons/go";
import { HiDocumentText } from "react-icons/hi2";
import { RiWhatsappFill } from "react-icons/ri";

export default function FormRegister({ session }: { session?: SessionLucia }) {
  const { refresh, push } = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    control,
  } = useForm<UserRegister>({
    resolver: zodResolver(UserRegisterSchema),
  });
  useEffect(() => {
    const keys = Object.keys(errors);
    if (keys.length === 0) return;
    const labels: Record<string, string> = {
      nama: "Nama",
      no_identitas: "NIK",
      nomor: "No. WhatsApp",
      alamat: "Alamat",
      npwp: "NPWP",
      user: "Username",
      password: "Password",
      file_identitas: "File NIK",
      file_npwp: "File NPWP",
    };
    toast(
      () => (
        <ol>
          {keys.map((ekey) => {
            const key = ekey as keyof typeof errors;
            const raw = errors[key]?.message;
            const message =
              !raw || raw === "Required" ? "wajib diisi." : raw;
            return (
              <li
                key={ekey}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <FaExclamationCircle style={{ color: "red", width: "14px" }} />
                {(labels[ekey] ?? ekey) + " " + message}
              </li>
            );
          })}
        </ol>
      ),
      {}
    );
  }, [errors]);
  // useEffect(() => {
  //   const subscription = watch((value, { name, type }) =>
  //     console.log(value, name, type)
  //   );
  //   return () => subscription.unsubscribe();
  // }, [watch]);
  const [visiblePass, setVisiblePass] = useState<boolean>(false);

  const [mutating, setMutating] = useState<boolean>(false);
  const [challengeToken, setChallengeToken] = useState<string>("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const resp = await fetch("/api/auth/register-challenge", {
          cache: "no-store",
        });
        const json = await resp.json();
        if (active && resp.ok && json?.data?.token) {
          setChallengeToken(json.data.token);
        }
      } catch {
        /* challenge akan ditolak di server jika kosong */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const submitHandler: SubmitHandler<UserRegister> = async (data, e) => {
    e?.preventDefault();
    setMutating(true);
    const formData = new FormData();
    (Object.keys(data) as (keyof UserRegister)[]).forEach((key) => {
      const value = data[key];
      if (value instanceof File) {
        formData.append(key, value);
      } else if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });
    // Sertakan honeypot (di luar RHF) agar bot yang mengisi field tersembunyi tertangkap API
    const formEl = e?.target as HTMLFormElement | undefined;
    const honeypot =
      formEl instanceof HTMLFormElement
        ? String(new FormData(formEl).get("website") ?? "")
        : "";
    formData.append("website", honeypot);
    formData.append("challenge", challengeToken);
    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
      });
      const json: unknown = await resp.json();
      if (!resp.ok) {
        const known: Record<string, string> = {
          "Too many requests, please try again later":
            "Terlalu banyak percobaan. Coba lagi sebentar lagi.",
          "Data is not valid": "Data pendaftaran belum lengkap atau tidak sesuai.",
          "Invalid username":
            "Username hanya boleh huruf kecil, angka, garis bawah, atau tanda hubung.",
          "Username is taken": "Username sudah dipakai.",
          "Invalid password (min 8 characters)": "Password minimal 8 karakter.",
        };
        const message =
          typeof json === "string" && json.trim()
            ? known[json] ?? json
            : json &&
                typeof json === "object" &&
                "error" in json &&
                typeof json.error === "string"
              ? json.error
              : "Terjadi kesalahan pada server";
        throw new Error(message);
      }
      sendRegister(parseInt(data.nomor));
      toast.success(
        json && typeof json === "object" && "message" in json && typeof json.message === "string"
          ? json.message
          : "Pendaftaran terkirim."
      );
      push("/login");
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || "Terjadi kesalahan pada server");
    } finally {
      setMutating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="w-full px-6 py-4">
      <Fieldset className="mx-auto grid max-w-xs">
        <div className="my-5 flex justify-center">
          <Image
            src={Logo}
            alt="WINET"
            className="h-auto w-36"
            loading="eager"
            decoding="sync"
            priority
          />
        </div>
        <p className="mb-6 text-center text-sm font-medium text-slate-800 dark:text-theme-fg">
          Daftar
        </p>
        {/* <Legend className="font-semibold text-center mb-2">
          Router Monitoring
        </Legend> */}
        <div className="grid gap-2 mb-8">
          {/* Honeypot — bots mengisi field tersembunyi; manusia tidak melihat */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
            defaultValue=""
          />
          <Field className="relative">
            <Label
              className="absolute top-1.5 left-3 text-xs/tight text-slate-600 dark:text-theme-fg-muted"
              htmlFor="nama"
            >
              Nama
            </Label>
            <FaRegUserCircle className="size-3 absolute left-3 bottom-3" />
            <Input
              className="bg-slate-300/90 dark:bg-theme-elevated placeholder:text-slate-600/60 dark:placeholder:text-theme-fg-muted text-slate-900 dark:text-theme-fg pl-8 pt-6"
              id="nama"
              {...register("nama")}
            />
          </Field>
          <Field className="relative">
            <Label
              className="absolute top-1.5 left-3 text-xs/tight text-slate-600 dark:text-theme-fg-muted"
              htmlFor="no_identitas"
            >
              NIK
            </Label>
            <FaRegIdCard className="size-3 absolute left-3 top-8" />
            <Input
              id="no_identitas"
              className="bg-slate-300/90 dark:bg-theme-elevated placeholder:text-slate-600/60 dark:placeholder:text-theme-fg-muted text-slate-900 dark:text-theme-fg pl-8 pt-6"
              {...register("no_identitas")}
            />
            <Controller
              name="file_identitas"
              control={control}
              render={({ field }) => (
                <InputDropzoneFile
                  className="bg-slate-300/90 dark:bg-theme-elevated placeholder:text-slate-600/60 dark:placeholder:text-theme-fg-muted text-slate-900 dark:text-theme-fg mt-2 text-xs"
                  field={field}
                  placeholder="Klik untuk memilih file NIK"
                />
              )}
            />
          </Field>
          <Field className="relative">
            <Label
              className="absolute top-1.5 left-3 text-xs/tight text-slate-600 dark:text-theme-fg-muted"
              htmlFor="nomor"
            >
              No. Whatsapp
            </Label>
            <RiWhatsappFill className="size-3 absolute left-3 bottom-3" />
            <Controller
              control={control}
              name="nomor"
              render={({ field }) => (
                <InputPhone
                  {...field}
                  id="nomor"
                  value={field.value || ""}
                  className="bg-slate-300/90 dark:bg-theme-elevated placeholder:text-slate-600/60 dark:placeholder:text-theme-fg-muted text-slate-900 dark:text-theme-fg pl-8 pt-6"
                />
              )}
            />
          </Field>
          <Field className="relative">
            <Label
              className="absolute top-1.5 left-3 text-xs/tight text-slate-600 dark:text-theme-fg-muted"
              htmlFor="alamat"
            >
              Alamat
            </Label>
            <GoHomeFill className="size-3 absolute left-3 bottom-3" />
            <Input
              id="alamat"
              className="bg-slate-300/90 dark:bg-theme-elevated placeholder:text-slate-600/60 dark:placeholder:text-theme-fg-muted text-slate-900 dark:text-theme-fg pl-8 pt-6"
              {...register("alamat")}
            />
          </Field>
          <Field className="relative">
            <Label
              className="absolute top-1.5 left-3 text-xs/tight text-slate-600 dark:text-theme-fg-muted"
              htmlFor="npwp"
            >
              NPWP
            </Label>
            <HiDocumentText className="size-3 absolute left-3 top-8" />
            <Input
              id="npwp"
              className="bg-slate-300/90 dark:bg-theme-elevated placeholder:text-slate-600/60 dark:placeholder:text-theme-fg-muted text-slate-900 dark:text-theme-fg pl-8 pt-6"
              {...register("npwp")}
            />
            <Controller
              name="file_npwp"
              control={control}
              render={({ field }) => (
                <InputDropzoneFile
                  className="bg-slate-300/90 dark:bg-theme-elevated placeholder:text-slate-600/60 dark:placeholder:text-theme-fg-muted text-slate-900 dark:text-theme-fg mt-2 text-xs"
                  field={field}
                  placeholder="Klik untuk memilih file NPWP"
                />
              )}
            />
          </Field>
          <Field className="relative">
            <Label
              className="absolute top-1.5 left-3 text-xs/tight text-slate-600 dark:text-theme-fg-muted"
              htmlFor="username"
            >
              Username
            </Label>
            <FaUserAlt className="size-2.5 absolute left-3 bottom-3" />
            <Input
              className="bg-slate-300/90 dark:bg-theme-elevated placeholder:text-slate-600/60 dark:placeholder:text-theme-fg-muted text-slate-900 dark:text-theme-fg pl-8 pt-6"
              id="username"
              {...register("user")}
              autoComplete="username"
            />
          </Field>
          <Field className="relative">
            <Label
              className="absolute top-1.5 left-3 text-xs/tight text-slate-600 dark:text-theme-fg-muted"
              htmlFor="password"
            >
              Password
            </Label>
            <FaLock className="size-2.5 absolute left-3 bottom-3" />
            <Input
              className="bg-slate-300/90 dark:bg-theme-elevated placeholder:text-slate-600/60 dark:placeholder:text-theme-fg-muted text-slate-900 dark:text-theme-fg pl-8 pt-6"
              id="password"
              type={visiblePass ? "text" : "password"}
              {...register("password")}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-theme-fg-muted"
              aria-label={visiblePass ? "Sembunyikan password" : "Tampilkan password"}
              aria-pressed={visiblePass}
              onClick={() => setVisiblePass((current) => !current)}
            >
              {visiblePass ? (
                <FaRegEyeSlash className="size-3.5" />
              ) : (
                <FaRegEye className="size-3.5" />
              )}
            </button>
          </Field>
        </div>
        <Button
          type="submit"
          color="red"
          className="justify-center bg-red-500"
          loading={mutating}
        >
          Daftar
        </Button>
        <div className="text-xs mt-0.5">
          <span>Sudah memiliki akun? </span>
          <span>
            <Link href="/login" className="font-semibold text-slate-800 underline-offset-2 hover:underline dark:text-theme-fg">
              Login disini.
            </Link>
          </span>
        </div>
        <AuthInfoLinks showLegalNote />
      </Fieldset>
    </form>
  );
}
