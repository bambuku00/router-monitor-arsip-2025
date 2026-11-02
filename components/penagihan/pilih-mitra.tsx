"use client";

import { useRouter } from "next/navigation";

export default function PilihMitraPenagihan(props: {
  mitras: { id: number; nama: string }[];
  selectedId: number | null;
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="shrink-0">Mitra</span>
      <select
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-theme-border dark:bg-theme-card"
        value={props.selectedId ?? ""}
        aria-label="Pilih mitra"
        onChange={(event) => {
          const id = event.target.value;
          router.push(id ? `/data-penagih?mitraId=${id}` : "/data-penagih");
        }}
      >
        <option value="">Pilih mitra</option>
        {props.mitras.map((mitra) => (
          <option key={mitra.id} value={mitra.id}>
            {mitra.nama}
          </option>
        ))}
      </select>
    </label>
  );
}
