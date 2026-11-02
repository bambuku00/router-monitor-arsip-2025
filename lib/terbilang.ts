const SATUAN = [
  "",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
  "sepuluh",
  "sebelas",
];

function penyebut(nilai: number): string {
  const n = Math.floor(Math.abs(nilai));
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${penyebut(n - 10)} belas`;
  if (n < 100) {
    return `${penyebut(Math.floor(n / 10))} puluh ${penyebut(n % 10)}`.trim();
  }
  if (n < 200) return `seratus ${penyebut(n - 100)}`.trim();
  if (n < 1000) {
    return `${penyebut(Math.floor(n / 100))} ratus ${penyebut(n % 100)}`.trim();
  }
  if (n < 2000) return `seribu ${penyebut(n - 1000)}`.trim();
  if (n < 1000000) {
    return `${penyebut(Math.floor(n / 1000))} ribu ${penyebut(n % 1000)}`.trim();
  }
  if (n < 1000000000) {
    return `${penyebut(Math.floor(n / 1000000))} juta ${penyebut(n % 1000000)}`.trim();
  }
  if (n < 1000000000000) {
    return `${penyebut(Math.floor(n / 1000000000))} milyar ${penyebut(n % 1000000000)}`.trim();
  }
  return `${penyebut(Math.floor(n / 1000000000000))} trilyun ${penyebut(n % 1000000000000)}`.trim();
}

/** Angka ke terbilang bahasa Indonesia (rupiah). */
export function terbilangRupiah(nilai: number): string {
  const n = Math.round(Number(nilai));
  if (!Number.isFinite(n)) return "";
  const words = n < 0 ? `minus ${penyebut(n)}` : penyebut(n);
  return words.replace(/\s+/g, " ").trim();
}
