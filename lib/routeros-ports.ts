/** Port default MikroTik API biasa (plain). */
export const ROUTEROS_PLAIN_API_PORT = 8728;

/** Port default MikroTik API-SSL/TLS. */
export const ROUTEROS_SSL_API_PORT = 8729;

export type RouterOsExpectedProtocol = "plain" | "ssl" | "unknown";

/** Port bukan indikator protokol — API plain maupun API-SSL dapat memakai port custom. */
export function expectedProtocolForPort(_port: number): RouterOsExpectedProtocol {
  return "unknown";
}

/** Semua koneksi wajib deteksi protokol via probe TCP sebelum login. */
export function requiresProtocolPreflight(_port?: number | null): boolean {
  return true;
}

/** Ambil routerId dari label sesi, mis. `health:12` atau `syncPPP:3`. */
export function parseRouterIdFromLabel(label: string): number | undefined {
  const match = label.match(/:(\d+)(?:$|:)/);
  if (!match) return undefined;
  const id = parseInt(match[1], 10);
  return Number.isFinite(id) ? id : undefined;
}
