import Link from "next/link";

type PppLoadErrorProps = {
  message: string;
  routerId: number;
  routerName?: string;
};

export default function PppLoadError({
  message,
  routerId,
  routerName,
}: PppLoadErrorProps) {
  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 px-6 py-10 text-center dark:border-amber-800 dark:bg-amber-950/40">
      <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
        Data PPPoE tidak dapat dimuat
      </h2>
      {routerName ? (
        <p className="text-sm text-amber-800/90 dark:text-amber-200/90">
          Router: <span className="font-medium">{routerName}</span>
        </p>
      ) : null}
      <p className="text-sm text-amber-800 dark:text-amber-200">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          href={`/router/${routerId}`}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900"
        >
          Kembali ke detail router
        </Link>
        <Link
          href="/routers"
          className="text-sm font-medium text-slate-600 underline hover:text-slate-900 dark:text-slate-300"
        >
          Daftar router
        </Link>
      </div>
    </div>
  );
}
