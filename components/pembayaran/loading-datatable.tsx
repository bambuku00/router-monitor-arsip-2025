export function LoadingDataTable({
  withAksiColumn = false,
  withInputterColumn = false,
  withPenagihColumn = false,
}: {
  withAksiColumn?: boolean;
  withInputterColumn?: boolean;
  withPenagihColumn?: boolean;
}) {
  return (
    <>
      {[...Array(10)].map((_, idx) => (
        <tr
          className="bg-slate-50/80 dark:bg-theme-card/30 hover:text-sky-600 divide-x divide-y divide-slate-100 dark:divide-theme-border/40"
          key={idx}
        >
          <td className="whitespace-pre-wrap px-4 py-2">
            <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-4" />
          </td>
          <td className="whitespace-pre-wrap px-4 py-2">
            <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-16" />
          </td>
          <td className="whitespace-pre-wrap px-4 py-2">
            <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-16" />
          </td>
          {withPenagihColumn ? (
            <td className="whitespace-pre-wrap px-4 py-2">
              <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-24" />
            </td>
          ) : null}
          <td className="whitespace-pre-wrap px-4 py-2">
            <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-20" />
          </td>
          <td className="whitespace-pre-wrap px-4 py-2">
            <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-24" />
          </td>
          <td className="whitespace-pre-wrap px-4 py-2">
            <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-12 mx-auto" />
          </td>
          <td className="whitespace-pre-wrap px-4 py-2">
            <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-24" />
          </td>
          {[...Array(1)].map((_, loadIdx) => (
            <td key={"pemb-load-" + loadIdx} className="px-4 py-2">
              <div className="animate-pulse rounded-sm bg-slate-300/60 h-8 w-full" />
            </td>
          ))}
          {withInputterColumn ? (
            <td className="whitespace-pre-wrap px-4 py-2">
              <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-20 mx-auto" />
            </td>
          ) : null}
          {withAksiColumn ? (
            <td className="whitespace-pre-wrap px-4 py-2">
              <div className="flex justify-center gap-1.5">
                <div className="animate-pulse rounded-sm bg-slate-300/60 h-6 w-6" />
                <div className="animate-pulse rounded-sm bg-slate-300/60 h-6 w-6" />
              </div>
            </td>
          ) : null}
        </tr>
      ))}
    </>
  );
}
