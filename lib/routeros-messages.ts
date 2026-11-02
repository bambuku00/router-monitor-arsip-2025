import { RouterOSConnectError } from "@/lib/routeros-client";

/** IP/port tidak dapat dihubungi (ECONNREFUSED, timeout TCP, DNS, dll.). */
export const ROUTEROS_UNREACHABLE_MSG =
  "IP atau port tidak dapat dihubungi. Periksa alamat, port API, firewall, dan pastikan layanan API MikroTik aktif.";

/** Port terbuka tetapi bukan API RouterOS biasa / protokol tidak cocok. */
export const ROUTEROS_PROTOCOL_UNCERTAIN_MSG =
  "Port terbuka, tetapi bukan layanan MikroTik API biasa atau protokolnya tidak cocok. Saat ini aplikasi hanya mendukung MikroTik API biasa. Periksa port API, aktifkan service API biasa, atau ubah konfigurasi router agar memakai API biasa.";

/** Respons TLS terdeteksi — kemungkinan API-SSL. */
export const ROUTEROS_SSL_REQUIRED_MSG =
  "Service yang aktif kemungkinan MikroTik API-SSL/TLS. Saat ini aplikasi belum mendukung API-SSL. Aktifkan service API biasa atau gunakan port API biasa.";

/** @deprecated Gunakan {@link ROUTEROS_SSL_REQUIRED_MSG}. */
export const ROUTEROS_SSL_MISMATCH_MSG = ROUTEROS_SSL_REQUIRED_MSG;

/** Login gagal setelah koneksi API biasa. */
export const ROUTEROS_AUTH_FAILED_MSG = "Username atau password RouterOS salah.";

/** Respons API tidak dapat diparse / tidak sesuai protokol login. */
export const ROUTEROS_MALFORMED_RESPONSE_MSG =
  "Respons RouterOS tidak valid. Periksa port API dan protokol (plain vs SSL).";

/** Koneksi terputus saat login atau operasi API. */
export const ROUTEROS_CONNECTION_CLOSED_MSG =
  "Koneksi RouterOS terputus. Periksa jaringan, firewall, dan layanan API MikroTik.";

export function isUnreachableNetworkCode(code?: string): boolean {
  return (
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    code === "EAI_AGAIN"
  );
}

export function isConnectionClosedCode(code?: string): boolean {
  return (
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "ECONNABORTED" ||
    code === "ERR_SOCKET_CLOSED"
  );
}

export function isRouterOsAuthFailure(err: unknown): boolean {
  const e = err as Error & { code?: string; errno?: string | number };
  if (e.code === "ROUTEROS_AUTH_FAILED") return true;

  const msg = (e.message || "").toLowerCase();
  if (
    e.name === "RosException" &&
    "errno" in e &&
    String(e.errno) === "CANTLOGIN"
  ) {
    return true;
  }

  // Hanya trap autentikasi eksplisit — jangan map error jaringan/protokol ke auth.
  return (
    msg.includes("invalid user name or password") ||
    msg.includes("wrong username or password") ||
    (msg.includes("cantlogin") && !msg.includes("timeout") && !msg.includes("ssl"))
  );
}

export function routerOsUnreachableError(): RouterOSConnectError {
  return new RouterOSConnectError(ROUTEROS_UNREACHABLE_MSG, "ROUTEROS_UNREACHABLE");
}

export function routerOsUncertainError(): RouterOSConnectError {
  return new RouterOSConnectError(
    ROUTEROS_PROTOCOL_UNCERTAIN_MSG,
    "ROUTEROS_PROTOCOL_UNCERTAIN"
  );
}

export function routerOsSslRequiredError(): RouterOSConnectError {
  return new RouterOSConnectError(ROUTEROS_SSL_REQUIRED_MSG, "ROUTEROS_SSL_REQUIRED");
}

export function routerOsAuthFailedError(): RouterOSConnectError {
  return new RouterOSConnectError(ROUTEROS_AUTH_FAILED_MSG, "ROUTEROS_AUTH_FAILED");
}

export function routerOsMalformedResponseError(): RouterOSConnectError {
  return new RouterOSConnectError(
    ROUTEROS_MALFORMED_RESPONSE_MSG,
    "ROUTEROS_MALFORMED_RESPONSE"
  );
}

export function routerOsConnectionClosedError(): RouterOSConnectError {
  return new RouterOSConnectError(
    ROUTEROS_CONNECTION_CLOSED_MSG,
    "ROUTEROS_CONNECTION_CLOSED"
  );
}

export function routerOsConnectTimeoutError(): RouterOSConnectError {
  return new RouterOSConnectError(
    "Koneksi RouterOS habis waktu. Periksa host, port, dan protokol API (biasa vs SSL).",
    "ROUTEROS_CONNECT_TIMEOUT"
  );
}

/** Pesan user-facing dari kode/error RouterOS. */
export function userFacingRouterOsErrorMessage(err: unknown): string {
  if (err instanceof RouterOSConnectError) return err.message;

  const e = err as Error & { code?: string };
  if (isRouterOsAuthFailure(e)) return ROUTEROS_AUTH_FAILED_MSG;

  const code = typeof e.code === "string" ? e.code : "";
  if (code === "ROUTEROS_UNREACHABLE" || isUnreachableNetworkCode(code)) {
    return ROUTEROS_UNREACHABLE_MSG;
  }
  if (code === "ROUTEROS_PROTOCOL_UNCERTAIN") return ROUTEROS_PROTOCOL_UNCERTAIN_MSG;
  if (code === "ROUTEROS_SSL_REQUIRED") return ROUTEROS_SSL_REQUIRED_MSG;
  if (code === "ROUTEROS_AUTH_FAILED") return ROUTEROS_AUTH_FAILED_MSG;
  if (code === "ROUTEROS_MALFORMED_RESPONSE") return ROUTEROS_MALFORMED_RESPONSE_MSG;
  if (code === "ROUTEROS_CONNECTION_CLOSED") return ROUTEROS_CONNECTION_CLOSED_MSG;
  if (code === "ROUTEROS_CONNECT_TIMEOUT") {
    return routerOsConnectTimeoutError().message;
  }

  const msg = (e.message || "").trim();
  return msg || ROUTEROS_UNREACHABLE_MSG;
}
