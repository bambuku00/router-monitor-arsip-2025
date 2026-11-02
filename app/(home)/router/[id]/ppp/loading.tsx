import PppWorkGreeting from "@/components/router/ppp/work-greeting";
import { FaChevronDown } from "react-icons/fa6";

export default function LoadingRouterPPP() {
  return (
    <div className="flex flex-col items-center bg-white dark:bg-theme-bg gap-4 w-full">
      <section className="md:grid md:grid-cols-3 md:gap-4 md:pb-0 flex flex-col-reverse gap-2 pb-6 w-full relative">
        <div className="max-w-2xl flex gap-2">
          <div className="h-8 w-full bg-slate-300/60 animate-pulse" />
          <button
            type="button"
            className="rounded bg-slate-300/60 animate-pulse px-2 py-1"
          >
            <div className="size-4"></div>
          </button>
        </div>

        <div className="relative max-w-2xl col-span-1">
          <div className="mx-auto animate-pulse h-12 w-full flex max-w-[44rem] rounded-md bg-slate-300/60 p-0.5" />
        </div>

        <div className="flex flex-col gap-2 col-span-3 justify-center sm:col-span-1">
          <div className="ml-auto pl-3 animate-pulse h-9 w-full relative md:max-w-60 flex items-center max-w-[44rem] rounded-md bg-slate-300/60 p-0.5">
            <p>Semua Paket</p>
            <div className="group absolute top-1/2 -translate-y-1/2 right-0 px-2.5">
              <FaChevronDown className="size-4 fill-gray-900/60 group-data-[hover]:fill-gray-900" />
            </div>
          </div>
        </div>
        <div className="absolute -bottom-4 w-full flex flex-col md:flex-row md:justify-between text-[10px]/3 sm:text-xs text-slate-700/90">
          <p>Terakhir sinkron: -</p>
          <p>
            Catatan: Data Pelanggan jika sudah terisi memiliki logo centang
            disebelah kanan
          </p>
        </div>
      </section>
      <div className="relative w-full md:pt-4">
      <div className="hidden md:block">
        <PppWorkGreeting />
      </div>
      <section className="relative z-10 w-full overflow-x-auto rounded bg-white text-sm shadow dark:bg-theme-card">
        <table className="min-w-full">
          <thead>
            <tr className="divide-x divide-slate-50 bg-slate-300/70 *:px-4 *:py-2">
              <td>No.</td>
              <td>Nama</td>
              <td>PPP</td>
              <td>Komentar</td>
              <td>Profil</td>
              <td>Address</td>
              <td>Paket</td>
              <td>
                <p>Harga</p>
              </td>
              <td>Aktif</td>
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
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-20" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-14" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-24" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-20" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-24" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-20" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-28" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="animate-pulse rounded-sm bg-slate-300/60 h-5 w-8" />
                </td>
                <td className="whitespace-pre-wrap px-4 py-2">
                  <div className="flex gap-2 justify-center">
                    <button className="rounded py-0.5 px-2 animate-pulse bg-slate-300/60 text-slate-400/80">
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
    </div>
  );
}
