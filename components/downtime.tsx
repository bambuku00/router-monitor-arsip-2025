import { Loader2 } from "lucide-react";

export default function Downtime() {
  return (
    <main className="min-h-dvh grid items-center bg-white">
      <div className="flex h-full max-h-dvh justify-center text-slate-700">
        <div className="flex justify-center p-4 items-center h-screen flex-col gap-12">
          <section className="flex flex-col items-center gap-6">
            <p className="text-5xl">Sedang proses migrasi data</p>
            <Loader2 className="size-20 animate-spin" />
            <p className="text-2xl">Estimasi waktu 1 hari.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
