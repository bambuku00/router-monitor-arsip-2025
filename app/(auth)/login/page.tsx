import CarouselImg from "@/components/auth/carousel-img";
import FormLogin from "@/components/auth/form-login";
import { validateRequest } from "@/lib/auth";
import { resolvePostLoginPath } from "@/lib/staff-menu-access";
import { redirect } from "next/navigation";

export default async function LoginPage() {
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
    // <div className="flex h-full justify-end text-slate-700">
    //   <CarouselImg />
    //   <section className="border flex flex-col justify-center items-center py-8 basis-full sm:basis-96 bg-slate-200">
    <FormLogin />
    //   </section>
    // </div>
  );
}
