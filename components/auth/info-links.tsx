const WINET_INFO_LINKS = [
  { href: "https://winet.id/", label: "Website Utama" },
  { href: "https://winet.id/kebijakan-privasi.html", label: "Kebijakan Privasi" },
  { href: "https://winet.id/ketentuan-layanan.html", label: "Ketentuan Layanan" },
  { href: "https://winet.id/tentang-kami.html", label: "Tentang Kami" },
  { href: "https://winet.id/kontak.html", label: "Kontak Support" },
] as const;

export default function AuthInfoLinks({
  showLegalNote = false,
}: {
  showLegalNote?: boolean;
}) {
  return (
    <nav aria-label="Informasi WINET" className="mt-6 grid gap-3 text-center">
      {showLegalNote ? (
        <p className="text-xs leading-relaxed text-slate-600 dark:text-theme-fg-muted">
          Kebijakan Privasi dan Ketentuan Layanan tersedia di website utama WINET.
        </p>
      ) : null}
      <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        {WINET_INFO_LINKS.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline dark:text-theme-fg"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
