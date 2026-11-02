const RESERVED = new Set(["masuk"]);

/** Huruf kecil, angka, dan tanda hubung. Kosong menjadi null. */
export function normalizePortalSlug(raw: unknown): string | null {
  if (raw == null) return null;
  const slug = String(raw).trim().toLowerCase();
  return slug.length === 0 ? null : slug;
}

/** null jika slug boleh disimpan. `enabled` mewajibkan slug terisi. */
export function portalSlugError(
  slug: string | null,
  enabled: boolean
): string | null {
  if (!slug) {
    return enabled ? "Isi link Portal Pelanggan sebelum dihidupkan." : null;
  }
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug) || RESERVED.has(slug)) {
    return "Link hanya huruf kecil, angka, dan tanda hubung, 3–32 karakter.";
  }
  return null;
}

/** Kosong berarti PIN lama tidak diubah. */
export function normalizePortalPin(raw: unknown): string | null {
  if (raw == null) return null;
  const pin = String(raw).trim();
  return pin.length === 0 ? null : pin;
}

export function portalPinError(pin: string | null): string | null {
  if (!pin) return null;
  if (pin.length < 4 || pin.length > 32) return "PIN 4–32 karakter.";
  return null;
}

/** Nomor CS WhatsApp. Kosong berarti hapus. */
export function normalizePortalWaCs(raw: unknown): string | null {
  if (raw == null) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("62")) digits = `0${digits.slice(2)}`;
  return digits;
}

export function portalWaCsError(nomor: string | null): string | null {
  if (!nomor) return null;
  if (nomor.length < 10 || nomor.length > 15 || !nomor.startsWith("0")) {
    return "Nomor CS 10–15 digit, diawali 0.";
  }
  return null;
}

export function portalWaCsUrl(nomor: string | null): string | null {
  if (!nomor || portalWaCsError(nomor)) return null;
  return `https://wa.me/62${nomor.slice(1)}`;
}

export function portalLoginPath(slug: string | null | undefined): string {
  const clean = normalizePortalSlug(slug);
  if (!clean || portalSlugError(clean, false)) return "/pppoe/masuk";
  return `/pppoe/${clean}`;
}
