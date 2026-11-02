export default function LoadingRouters() {
  return (
    <div className="flex flex-col gap-4 items-center bg-white dark:bg-theme-bg w-full">
      <section className="grid grid-cols-3 gap-4 w-full relative">
        <div className="max-w-sm flex gap-2">
          <div className="h-8 w-full bg-slate-300/60 animate-pulse" />
        </div>
        <p className="flex justify-center font-medium">Routers List</p>
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
              <td>No.</td>
              <td>Nama</td>
              <td>Host</td>
              <td>Port</td>
              <td>User</td>
              <td>Tgl. Input</td>
              <td className="text-center">*</td>
            </tr>
          </thead>
          <tbody>
            {[...Array(10)].map((_, idx) => (
              <tr className="bg-slate-50/80 hover:text-sky-600" key={idx}>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-4" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-16" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-24" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-8" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-16" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-16" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="flex gap-2 justify-center">
                    <button className="rounded py-1 px-2 animate-pulse bg-slate-300/60 text-slate-400/80">
                      <div className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
