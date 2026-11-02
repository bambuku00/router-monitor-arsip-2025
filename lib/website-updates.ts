export type WebsiteUpdateTag = "menu" | "fitur" | "perbaikan";

export type WebsiteUpdateSection = {
  heading: string;
  items: string[];
};

export type WebsiteUpdateEntry = {
  /** ID unik, biasanya tanggal rilis YYYY-MM-DD */
  id: string;
  date: string;
  title: string;
  summary?: string;
  tags?: WebsiteUpdateTag[];
  /** Label kategori tampilan (mis. emoji + teks), opsional */
  categories?: string[];
  sections: WebsiteUpdateSection[];
};

/**
 * Daftar pembaruan — tambahkan entry baru di ATAS array saat deploy fitur/menu baru.
 */
export const WEBSITE_UPDATES: WebsiteUpdateEntry[] = [
  {
    id: "2026-07-22-deps-security",
    date: "2026-07-22",
    title: "Pembaruan keamanan dependency (npm audit bersih)",
    summary:
      "Maintenance paket: vulnerability dompurify & sharp/libvips diperbaiki tanpa upgrade mayor Next.js. Build production lulus; npm audit: 0 vulnerabilities.",
    tags: ["perbaikan"],
    categories: ["🔒 Keamanan", "📦 Dependency"],
    sections: [
      {
        heading: "Dependency yang diubah",
        items: [
          "next & eslint-config-next: 15.5.20 → 15.5.21 (patch keamanan/stabilitas, tetap Next 15).",
          "react & react-dom: 19.2.7 → 19.2.8 (patch minor).",
          "sharp: 0.33.5 → 0.35.3 + override agar salinan nested Next ikut aman (libvips CVE).",
          "dompurify (override): 3.4.11 → 3.4.12 (perbaikan bypass sanitasi).",
          "Patch non-breaking lain: fuse.js 7.5.0, libphonenumber-js 1.13.9, react-hook-form 7.82.0, postcss 8.5.22, @fontsource/roboto 5.3.0.",
        ],
      },
      {
        heading: "Vulnerability yang dihilangkan",
        items: [
          "dompurify ≤3.4.11 (GHSA-c2j3-45gr-mqc4) — low.",
          "sharp <0.35.0 / libvips CVE (GHSA-f88m-g3jw-g9cj) — high, termasuk yang terdeteksi lewat next.",
          "Hasil akhir: npm audit = 0 vulnerabilities.",
        ],
      },
      {
        heading: "Yang sengaja tidak diubah",
        items: [
          "Tidak upgrade Next.js 15 → 16 (mayor; butuh migrasi terpisah).",
          "Tidak pakai npm audit fix --force.",
          "Prisma 5, MUI 5, Tailwind 3, Zod 3 tetap — upgrade mayor ditunda.",
        ],
      },
      {
        heading: "Catatan Sharp & Next.js",
        items: [
          "Penyebab: Next 15 masih menarik sharp lama; CVE ada di libvips yang dibawa sharp <0.35.",
          "Solusi aman saat ini: pin/override sharp@0.35.3 (Node ≥20.9; lingkungan ini Node 22).",
          "Upgrade Next 16 tidak wajib hanya untuk menutup CVE ini; boleh dijadwalkan nanti sebagai migrasi terpisah.",
        ],
      },
    ],
  },
  {
    id: "2026-05-30-routeros",
    date: "2026-05-30",
    title: "Website tidak macet lagi saat koneksi router bermasalah",
    summary:
      "Diperbaiki masalah website yang bisa lambat atau tidak merespons jika router MikroTik disetel hanya API aman (SSL), sementara aplikasi memakai API biasa.",
    tags: ["perbaikan"],
    categories: ["🐞 Perbaikan Bug", "⚡ Performa"],
    sections: [
      {
        heading: "Apa yang diperbaiki",
        items: [
          "Website tetap lancar meskipun IP, port, atau password router salah.",
          "Sinkron PPP, sync paket, cek versi router, dan Tools MikroTik tidak lagi mengunci halaman.",
          "Sinkron PPP otomatis jalan lagi ~3 detik setelah buka halaman PPP, tanpa mengganggu tampilan.",
          "Pesan error lebih jelas: tidak bisa hubungi router, port salah, butuh API biasa, atau login salah.",
        ],
      },
      {
        heading: "Yang perlu diingat",
        items: [
          "Aplikasi saat ini hanya mendukung API MikroTik biasa (non-SSL).",
          "Jika router hanya API aman/SSL, aktifkan API biasa di MikroTik dan isi port yang sama dengan yang dipakai di router (disarankan port custom, bukan port bawaan).",
        ],
      },
    ],
  },
  {
    id: "2026-05-30-malaml",
    date: "2026-05-30",
    title: "Pembaruan 30 Mei 2026",
    summary:
      "Banyak perbaikan tampilan, menu, pembayaran, kuitansi, dan fitur router agar lebih mudah dipakai sehari-hari.",
    tags: ["fitur", "menu", "perbaikan"],
    categories: ["✨ Fitur Baru", "🎨 Tampilan", "🐞 Perbaikan"],
    sections: [
      {
        heading: "Tampilan & menu",
        items: [
          "Dashboard lebih rapi dengan grafik pembayaran dan kartu ringkasan.",
          "Mode gelap (abu-abu tua) bisa dipilih; tampilan diseragamkan di banyak halaman.",
          "Menu bisa di atas atau di samping kiri (bisa dilipat, ingat pilihan Anda).",
          "Pengaturan jadi satu menu: bank, user, paket, router, isolir, dan tampilan.",
          "Tampilan HP di dashboard, pembayaran, dan pembukuan diperbaiki.",
        ],
      },
      {
        heading: "Router & pelanggan PPP",
        items: [
          "Halaman router dan PPP lebih rapi; ada tombol Performa dan sinkron PPPoE.",
          "Versi MikroTik terisi otomatis saat tambah router.",
          "Paket bisa diambil langsung dari MikroTik; edit harga paket tidak lagi nyangkut.",
          "Tools MikroTik tampilannya disamakan dengan halaman PPP.",
          "Harga dan PPN di form pelanggan mengikuti paket yang dipilih.",
        ],
      },
      {
        heading: "Pembayaran & tagihan",
        items: [
          "Angka tagihan tidak lagi loncat-loncat saat bayar atau batal bayar.",
          "Filter PPP bisa diklik (total, tagihan, berhenti, gratis, belum waktunya, tanpa tagihan).",
          "Tabel hanya menampilkan bulan yang dipilih; bisa atur jumlah baris per halaman.",
          "Filter isolir, tombol berhenti/langganan lagi, dan cetak laporan pembayaran.",
          "Kuitansi PDF per pelanggan — bisa dicek dulu lalu unduh.",
          "Hitungan BHP & USO untuk setoran ke ISP; pendapatan bersih sudah termasuk potongan.",
        ],
      },
      {
        heading: "Isolir & otomatisasi",
        items: [
          "Skrip isolir MikroTik v6 & v7 bisa diunduh dari aplikasi beserta panduannya.",
          "Pengaturan isolir otomatis dan log pindah ke menu Pengaturan.",
          "Tagihan bulanan bisa digenerate otomatis (jadwal server).",
          "Tombol isi data pelanggan PPP otomatis untuk yang belum lengkap.",
        ],
      },
    ],
  },
  {
    id: "2026-05-30",
    date: "2026-05-30",
    title: "Pembaruan Mei 2026",
    summary:
      "Penagihan lebih jelas: filter PPP, hitungan per paket, warna tagihan, dan pagination daftar pelanggan.",
    tags: ["fitur", "perbaikan"],
    sections: [
      {
        heading: "Pembayaran — filter & ringkasan PPP",
        items: [
          "Chip PPPoE per bulan (Total, Tagihan, Berhenti, Gratis, Blm waktu, Tanpa tagihan) — klik chip untuk memfilter daftar pelanggan.",
          "Filter Bayar ditambah: Total PPPoE, Tagihan, Berhenti, Gratis, Belum waktunya, Tanpa tagihan.",
          "Filter Semua + bulan: daftar kosong jika belum ada tagihan sama sekali di bulan itu; setelah ada tagihan, tampil yang relevan (tagihan + berhenti/gratis/belum waktunya).",
          "Chip kategori (Gratis, Blm waktu, dll.) nol jika bulan belum punya tagihan; Total tetap jumlah PPP terhubung.",
        ],
      },
      {
        heading: "Pembayaran — tampilan & tagihan",
        items: [
          "Warna sel tagihan: kuning selama masih bulan jatuh tempo, merah setelah bulan berganti (bukan lagi setelah tgl 20).",
          "Legenda: Belum (kuning) dan Tidak Terbayar (merah).",
          "Pagination Tampilkan 10/20/50/100 data di atas dan bawah tabel, sejajar legenda warna.",
          "Hitungan Per Paket: tabel Tagihan Aktif, Pelanggan Belum Waktunya, dan Pelanggan Berhenti terpisah; nilai rupiah dihitung per kategori (tidak digabung).",
        ],
      },
      {
        heading: "Staff & keamanan data",
        items: [
          "Staff Keuangan/Teknisi bisa di-scope ke pelanggan PPP tertentu (atur saat buat/edit user).",
          "Proteksi duplikat tagihan per pelanggan per bulan tetap aktif (generate + unique database).",
        ],
      },
    ],
  },
  {
    id: "2026-06-01",
    date: "2026-06-01",
    title: "Pembaruan Juni 2026",
    summary:
      "Halaman pembaruan, perbaikan pembayaran & cetak, serta otomatisasi data PPP pelanggan.",
    tags: ["fitur", "menu", "perbaikan"],
    sections: [
      {
        heading: "Menu & navigasi",
        items: [
          "Halaman Pembaruan Website (/pembaruan) — cek info fitur dan menu baru dari sini.",
        ],
      },
      {
        heading: "Pembayaran",
        items: [
          "Cetak laporan mengikuti filter aktif (belum/sudah bayar, staff, isolir).",
          "Kolom Tanggal Berlangganan tampil di bawah nama PPP pada daftar pelanggan.",
          "Status bulan terbayar: Terbayar Cash / Terbayar Transfer.",
          "Kolom Diproses oleh untuk staff Keuangan/Teknisi.",
          "Hak akses staff: isolir PPP & batalkan pembayaran (atur di User).",
        ],
      },
      {
        heading: "Router / PPP",
        items: [
          "Tombol Isi data — isi otomatis data pelanggan untuk PPP yang belum terdaftar.",
          "Tab filter Auto isi — tandai PPP yang diisi otomatis (badge kuning).",
          "Sinkron PPPoE otomatis ~3 detik setelah buka halaman PPP.",
          "Waktu Terakhir sinkron ikut ter-update saat sinkron otomatis.",
        ],
      },
      {
        heading: "Perbaikan",
        items: [
          "Layout cetak laporan lebih rapi (tanpa header/footer browser).",
          "Scope pembukuan & data staff Keuangan/Teknisi diperbaiki.",
        ],
      },
    ],
  },
];

export function formatUpdateDate(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

export function getLatestWebsiteUpdate(): WebsiteUpdateEntry | null {
  return WEBSITE_UPDATES[0] ?? null;
}

export const WEBSITE_UPDATE_TAG_LABELS: Record<WebsiteUpdateTag, string> = {
  menu: "Menu baru",
  fitur: "Fitur",
  perbaikan: "Perbaikan",
};
