import type { RouterOSClient } from "@/lib/routeros-client";
import { RouterOSConnectError } from "@/lib/routeros-client";
import {
  ROUTEROS_AUTH_FAILED_MSG,
  ROUTEROS_PROTOCOL_UNCERTAIN_MSG,
  ROUTEROS_SSL_REQUIRED_MSG,
  ROUTEROS_UNREACHABLE_MSG,
  isRouterOsAuthFailure,
  isUnreachableNetworkCode,
  userFacingRouterOsErrorMessage,
} from "@/lib/routeros-messages";
import { mapRouterOsVersionString } from "@/lib/routeros-version";
import type { SystemResource } from "@/lib/router-types";
import {
  ROUTEROS_CONNECT_TIMEOUT_MS,
  routerToCredentials,
  withRouterOsClientPreflight,
  type RouterOsCredentials,
} from "@/lib/routeros-session";

/** @deprecated Gunakan {@link ROUTEROS_CONNECT_TIMEOUT_MS} dari routeros-session. */
export const ROUTEROS_CONNECTION_TIMEOUT_MS = ROUTEROS_CONNECT_TIMEOUT_MS;

export type RouterOsProbeResult = {
  os_version: "v6" | "v7";
  version: string;
};

async function fetchRouterOsVersion(
  api: RouterOSClient
): Promise<RouterOsProbeResult | null> {
  const rows = (await api.write("/system/resource/print")) as unknown;
  const list = Array.isArray(rows) ? rows : [];
  const resource = list[0] as SystemResource | undefined;
  const version = resource?.version?.trim() ?? "";
  const os_version = mapRouterOsVersionString(version);
  if (!os_version) return null;
  return { os_version, version };
}

/**
 * Login RouterOS, opsional baca /system/resource/print untuk versi, lalu tutup.
 * @deprecated Prefer {@link probeRouterOsCredentials}.
 */
export async function probeRouterOs(
  api: RouterOSClient,
  options?: { detectVersion?: boolean }
): Promise<RouterOsProbeResult | null> {
  api.setSocketTimeout(ROUTEROS_CONNECT_TIMEOUT_MS);
  try {
    await api.connect();
    if (!options?.detectVersion) return null;
    return fetchRouterOsVersion(api);
  } finally {
    try {
      await api.close();
    } catch {
      api.forceDestroy();
    }
  }
}

/** Probe koneksi + deteksi versi dengan preflight fail-closed. */
export async function probeRouterOsCredentials(
  creds: RouterOsCredentials,
  label: string,
  options?: { detectVersion?: boolean }
): Promise<RouterOsProbeResult | null> {
  return withRouterOsClientPreflight(creds, label, async (api) => {
    if (!options?.detectVersion) return null;
    return fetchRouterOsVersion(api);
  });
}

/** Verifikasi koneksi RouterOS (connect saja). */
export async function verifyRouterOsCredentials(
  creds: RouterOsCredentials,
  label: string
): Promise<void> {
  await withRouterOsClientPreflight(creds, label, async () => undefined);
}

/**
 * Coba login RouterOS lalu tutup.
 * @deprecated Prefer {@link verifyRouterOsCredentials}.
 */
export async function verifyRouterOsConnection(api: RouterOSClient): Promise<void> {
  await probeRouterOs(api);
}

/** Pesan untuk pengguna panel (bukan detail teknis mentah). */
export function userFacingRouterOsConnectError(err: unknown): string {
  if (err instanceof RouterOSConnectError) return err.message;

  const e = err as Error & { errno?: number | string; code?: string };
  const code = typeof e.code === "string" ? e.code : "";
  const msg = (e.message || "").toLowerCase();

  if (isRouterOsAuthFailure(e)) return ROUTEROS_AUTH_FAILED_MSG;

  if (code === "ROUTEROS_UNREACHABLE" || isUnreachableNetworkCode(code)) {
    return ROUTEROS_UNREACHABLE_MSG;
  }
  if (code === "ROUTEROS_PROTOCOL_UNCERTAIN") return ROUTEROS_PROTOCOL_UNCERTAIN_MSG;
  if (code === "ROUTEROS_SSL_REQUIRED") return ROUTEROS_SSL_REQUIRED_MSG;
  if (code === "ROUTEROS_AUTH_FAILED") return ROUTEROS_AUTH_FAILED_MSG;

  if (
    code === "ROUTEROS_PROTOCOL_MISMATCH" ||
    code === "ROUTEROS_CONNECT_TIMEOUT" ||
    code === "ROUTEROS_SOCKET_TIMEOUT"
  ) {
    return userFacingRouterOsErrorMessage(err);
  }

  if (
    e.errno === -4078 ||
    e.errno === -3058 ||
    msg.includes("econnrefused") ||
    msg.includes("habis waktu") ||
    msg.includes("timeout")
  ) {
    return ROUTEROS_UNREACHABLE_MSG;
  }

  return userFacingRouterOsErrorMessage(err);
}

export { routerToCredentials };
