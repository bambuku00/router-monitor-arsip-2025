const SKIP_PROFILE_NAMES = new Set(["default"]);

/** Ubah rate Mikrotik (mis. 10M, 512k) ke Mbps. */
export function parseMikrotikRateToMbps(rate: string): number {
  const m = rate.trim().match(/^(\d+(?:\.\d+)?)([kKmMgG]?)$/i);
  if (!m) return 0;
  const num = parseFloat(m[1]);
  const unit = (m[2] || "m").toLowerCase();
  switch (unit) {
    case "g":
      return num * 1000;
    case "m":
      return num;
    case "k":
      return num / 1000;
    default:
      return num;
  }
}

/** Ambil kecepatan download (bagian pertama) dari rate-limit PPP profile. */
export function parseRateLimitToMbps(rateLimit?: string): number {
  if (!rateLimit?.trim()) return 0;
  const ratePart = rateLimit.trim().split(/\s+/)[0];
  const rxRate = ratePart.split("/")[0] ?? ratePart;
  return parseMikrotikRateToMbps(rxRate);
}

export function isImportablePppProfile(name: string): boolean {
  const trimmed = name.trim();
  return trimmed !== "" && !SKIP_PROFILE_NAMES.has(trimmed.toLowerCase());
}

/** Parse input form kapasitas: angka, 10M, 512k, 1G, atau "10 Mbps". */
export function parseKapasitasInputToMbps(
  input: string | number
): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) && input >= 0 ? input : null;
  }
  let trimmed = input.trim();
  if (!trimmed) return null;
  trimmed = trimmed.replace(/\s*mbps?\s*$/i, "").trim();

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  if (!/^(\d+(?:\.\d+)?)([kKmMgG])?$/i.test(trimmed)) {
    return null;
  }

  const mbps = parseMikrotikRateToMbps(trimmed);
  return Number.isFinite(mbps) && mbps >= 0 ? mbps : null;
}

/** Tampilan kapasitas tersimpan (Mbps). */
export function formatKapasitasMbps(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const text = Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/\.?0+$/, "");
  return `${text} Mbps`;
}
