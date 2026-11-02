import CarouselImg from "@/components/auth/carousel-img";
import FormLogin from "@/components/auth/form-login";
import FormRegister from "@/components/auth/form-register";
import { validateRequest } from "@/lib/auth";
import { getStaffWhitelistLandingPath } from "@/lib/staff-menu-access";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  const session = await validateRequest();

  if (session.user) {
    const landing =
      getStaffWhitelistLandingPath({
        role: session.user.role,
        id: session.user.id,
        parentId: session.user.parentId ?? null,
        staffMenuKeys: session.user.staffMenuKeys,
      }) ?? "/dashboard";
    redirect(landing);
  }

  return (
    // <div className="flex h-full justify-end text-slate-700">
    //   <CarouselImg />
    //   <section className="border flex flex-col justify-center items-center py-8 basis-full sm:basis-96 bg-slate-200">
    <FormRegister />
    //   </section>
    // </div>
  );
}
