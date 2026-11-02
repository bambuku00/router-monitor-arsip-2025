import { LoadingDataTable } from "@/components/pembayaran/loading-datatable";
import { cn } from "@/lib/utils";

export default function LoadingPembayaran() {
  return (
    <div className="flex flex-col gap-4 items-center bg-white dark:bg-theme-bg w-full">
      <section className="grid grid-cols-3 gap-4 w-full relative">
        <div className="max-w-sm flex gap-2">
          <div className="h-8 w-full bg-slate-300/60 animate-pulse" />
        </div>
        <p className="flex justify-center font-medium">Pembayaran</p>
        <button
          type="button"
          className="rounded py-1 px-2 animate-pulse bg-slate-300/60 text-slate-400/80 w-min justify-self-end"
        >
          <div className="w-14 h-6" />
        </button>
      </section>
      <section className="w-full overflow-x-auto rounded text-sm shadow">
        <table className="min-w-full">
          <thead>
            <tr className="divide-x divide-slate-50 bg-slate-300/70 *:px-4 *:py-2">
              <td rowSpan={2}>No.</td>
              <td rowSpan={2}>Router</td>
              <td rowSpan={2}>Nama</td>
              <td rowSpan={2}>PPN</td>
              <td rowSpan={2}>Tagihan Bulanan</td>
              <td rowSpan={2}>Alamat</td>
              <td
                className="text-center border-b border-b-slate-50"
                colSpan={12}
              >
                Bulan
              </td>
            </tr>
            <tr className="divide-x text-center divide-slate-50 bg-slate-300/70 *:px-4 *:py-2">
              {[...Array(12)].map((_, idx) => (
                <td
                  key={idx}
                  className={cn(idx === 0 && "border-l border-l-slate-50")}
                >
                  {String(idx + 1).length === 1 ? "0" + (idx + 1) : idx + 1}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            <LoadingDataTable />
          </tbody>
        </table>
      </section>
    </div>
  );
}
