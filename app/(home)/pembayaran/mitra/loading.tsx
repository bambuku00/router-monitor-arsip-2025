export default function LoadingPembayaran() {
  return (
    <div className="flex flex-col gap-4 items-center bg-white dark:bg-theme-bg w-full">
      <section className="grid grid-cols-3 gap-4 w-full relative">
        <div className="max-w-sm flex gap-2">
          <div className="h-8 w-full bg-slate-300/60 animate-pulse" />
        </div>

        <p className="flex justify-center font-medium">Pembayaran Mitra</p>
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
            <tr className="divide-x divide-slate-50 bg-slate-300/70 *:px-2.5 *:py-1">
              <td rowSpan={2} className="px-1">
                No.
              </td>
              <td rowSpan={2}>Nama</td>
              <td rowSpan={2}>Tanggal Inv.</td>
              <td rowSpan={2}>Total Omset</td>
              <td rowSpan={2}>Nett</td>
              <td rowSpan={2}>PPN</td>
              <td colSpan={2}>Pembagian Hasil</td>
              <td rowSpan={2}>Total Dibayar</td>
              <td rowSpan={2}>Saldo Tagihan</td>
              <td rowSpan={2}>Status Tagihan</td>
            </tr>
            <tr className="bg-slate-300/70 *:px-2.5 *:py-1 *:border *:border-slate-50">
              <td>Kantor</td>
              <td>Mitra</td>
            </tr>
          </thead>
          <tbody>
            {[...Array(10)].map((_, idx) => (
              <tr className="bg-slate-50/80 hover:text-sky-600" key={idx}>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-4" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-20" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-20" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-24" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-24" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-16" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-20" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-20" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-24" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-24" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-12" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
