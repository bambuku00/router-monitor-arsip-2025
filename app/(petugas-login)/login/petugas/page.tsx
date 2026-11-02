import AuthInfoLinks from "@/components/auth/info-links";
import FormLoginPetugas from "@/components/auth/form-login-petugas";
import { validateRequest } from "@/lib/auth";
import { resolvePostLoginPath } from "@/lib/staff-menu-access";
import Logo from "@/public/logo.png";
import { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Masuk Petugas",
};

export default async function PetugasLoginPage() {
  const session = await validateRequest();

  if (session.user) {
    redirect(
      resolvePostLoginPath({
        role: session.user.role,
        id: session.user.id,
        parentId: session.user.parentId ?? null,
        staffMenuKeys: session.user.staffMenuKeys,
      })
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 pt-[10vh] pb-8">
      <div className="flex flex-col rounded-3xl bg-white px-6 pt-10 pb-6 shadow-sm dark:bg-theme-card">
        <div className="flex justify-center">
          <Image src={Logo} alt="WINET" className="h-auto w-36" priority />
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Petugas penagihan
        </p>
        <div className="mt-8">
          <FormLoginPetugas />
        </div>
      </div>
      <AuthInfoLinks />
    </div>
  );
}
