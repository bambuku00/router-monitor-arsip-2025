export type PppIsolirRow = {
  isIsolir?: boolean;
  disabled?: string;
  profile?: string;
};

export type PppIsolirContext = {
  isolirProfileName?: string | null;
};

/** Status isolir PPP: profil isolir atau flag isolir di aplikasi. Disable secret di MikroTik bukan isolir. */
export function isPppIsolir(
  val: PppIsolirRow,
  ctx?: PppIsolirContext
): boolean {
  const isolirProfile = ctx?.isolirProfileName?.trim();
  if (isolirProfile && val.profile?.trim() === isolirProfile) return true;
  return val.isIsolir === true;
}

export function isolirActionLabel(
  val: PppIsolirRow,
  ctx?: PppIsolirContext
): string {
  return isPppIsolir(val, ctx) ? "Buka Isolir" : "Isolir Pelanggan";
}
