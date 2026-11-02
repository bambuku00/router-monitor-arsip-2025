import Link from "next/link";

export default function RouterNotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold text-slate-800 dark:text-theme-fg">
        Router tidak ditemukan
      </h1>
      <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
        Router dengan ID tersebut tidak ada atau sudah dihapus.
      </p>
      <Link
        href="/routers"
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Ke daftar router
      </Link>
    </div>
  );
}
