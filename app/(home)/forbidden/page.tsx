import ForbiddenActions from "@/components/forbidden-actions";
import { guardForbiddenPage } from "@/lib/home-page-guard";
import { getFirstAllowedRoute } from "@/lib/route-access";

export default async function ForbiddenPage() {
  const user = await guardForbiddenPage();
  const allowedRoute = user ? getFirstAllowedRoute(user) : null;

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-xl font-semibold text-slate-800 dark:text-theme-fg">
        Akses ditolak
      </h1>
      <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
        Akun Anda tidak memiliki izin membuka halaman ini. Hubungi Admin jika
        menurut Anda ini salah.
      </p>
      <ForbiddenActions allowedRoute={allowedRoute} />
    </div>
  );
}
