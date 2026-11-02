import {
  RouterOSClient,
  RouterOSConnectError,
  normalizeRouterOsConnectError,
} from "@/lib/routeros-client";
import { logRouterOsSession } from "@/lib/routeros-log";
import {
  detectRouterOsApiProtocol,
  ROUTEROS_PREFLIGHT_TIMEOUT_MS,
} from "@/lib/routeros-preflight";
import {
  expectedProtocolForPort,
  parseRouterIdFromLabel,
  ROUTEROS_PLAIN_API_PORT,
} from "@/lib/routeros-ports";

import {
  decryptRouterPassword,
  encryptRouterPassword,
} from "@/lib/router-password-crypto";
import { resolveMikrotikProxyConnectHost } from "@/lib/router-host-policy";

export { logRouterOsSession };

/** Batas waktu connect + idle socket RouterOS (ms). */
export const ROUTEROS_CONNECT_TIMEOUT_MS = 5_000;

export type RouterOsCredentials = {
  host: string;
  port?: number | null;
  user: string;
  password: string;
};

export function routerToCredentials(router: {
  host: string;
  port?: number | null;
  user: string;
  password: string;
}): RouterOsCredentials {
  return {
    host: router.host,
    port: router.port,
    user: router.user,
    password: decryptRouterPassword(router.password),
  };
}

/** Resolve host policy + DNS rebinding mitigation before dial (stored router hostnames). */
export async function routerToCredentialsWithHostPolicy(router: {
  host: string;
  port?: number | null;
  user: string;
  password: string;
}): Promise<RouterOsCredentials> {
  const host = await resolveMikrotikProxyConnectHost(router.host);
  return {
    host,
    port: router.port,
    user: router.user,
    password: decryptRouterPassword(router.password),
  };
}

/** Encrypt password sebelum simpan ke DB (create/update). */
export function encryptRouterPasswordForStorage(plaintext: string): string {
  return encryptRouterPassword(plaintext);
}

/**
 * Probe TCP non-auth: deteksi TLS vs plain API sebelum login.
 * Wajib untuk semua port (8728, 8729, maupun custom).
 */
export async function ensurePlainApiProtocolPreflight(
  creds: RouterOsCredentials,
  label: string
): Promise<void> {
  const port = creds.port ?? ROUTEROS_PLAIN_API_PORT;
  const routerId = parseRouterIdFromLabel(label);

  logRouterOsSession("preflight_start", label, {
    host: creds.host,
    port,
    routerId,
    connectionType: expectedProtocolForPort(port),
    stage: "preflight_start",
    attempt: 1,
    timeoutMs: ROUTEROS_PREFLIGHT_TIMEOUT_MS,
  });

  const preflight = await detectRouterOsApiProtocol(
    creds.host,
    port,
    ROUTEROS_PREFLIGHT_TIMEOUT_MS
  );

  if (!preflight.ok) {
    const code = preflight.error.code;
    if (
      code === "ROUTEROS_PROTOCOL_UNCERTAIN" ||
      code === "ROUTEROS_SSL_REQUIRED" ||
      code === "ROUTEROS_CONNECT_TIMEOUT"
    ) {
      logRouterOsSession("preflight_uncertain", label, {
        host: creds.host,
        port,
        routerId,
        connectionType: "unknown",
        stage: "preflight_failed",
        attempt: 1,
        code,
      });
    }
    throw preflight.error;
  }

  logRouterOsSession("preflight_ok", label, {
    host: creds.host,
    port,
    routerId,
    connectionType: "plain_probed",
    stage: "preflight_ok",
    attempt: 1,
  });
}

/**
 * Satu sesi RouterOS dengan Promise.race watchdog eksternal.
 * Watchdog HARUS dibuat sebelum operation/connect agar setTimeout terdaftar
 * meskipun login() library menggantung.
 */
export async function withRouterOsClient<T>(
  creds: RouterOsCredentials,
  label: string,
  fn: (api: RouterOSClient) => Promise<T>,
  timeoutMs = ROUTEROS_CONNECT_TIMEOUT_MS
): Promise<T> {
  await ensurePlainApiProtocolPreflight(creds, label);

  const api = new RouterOSClient(creds);
  api.setLogLabel(label);
  api.setSocketTimeout(timeoutMs);

  logRouterOsSession("connect_start", label, {
    host: creds.host,
    port: creds.port ?? ROUTEROS_PLAIN_API_PORT,
    timeoutMs,
    routerId: parseRouterIdFromLabel(label),
    connectionType: "plain",
    stage: "connect_start",
    attempt: 1,
  });

  let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  logRouterOsSession("before_watchdog_create", label, { timeoutMs });

  const watchdog = new Promise<never>((_, reject) => {
    watchdogTimer = setTimeout(() => {
      timedOut = true;
      logRouterOsSession("watchdog_fired", label, { timeoutMs });
      logRouterOsSession("timeout", label, { timeoutMs });
      api.forceDestroy();
      reject(
        new RouterOSConnectError(
          `Koneksi RouterOS habis waktu (${timeoutMs} ms). Periksa host, port, dan protokol API (biasa vs SSL).`,
          "ROUTEROS_CONNECT_TIMEOUT"
        )
      );
    }, timeoutMs);
  });

  logRouterOsSession("watchdog_created", label, {
    timeoutMs,
    timerId: watchdogTimer != null ? String(watchdogTimer) : "missing",
  });

  logRouterOsSession("before_promise_race", label);

  const operation = (async (): Promise<T> => {
    logRouterOsSession("operation_started", label);
    await api.connect();
    if (timedOut) {
      throw new RouterOSConnectError(
        `Koneksi RouterOS dibatalkan (timeout ${timeoutMs} ms)`,
        "ROUTEROS_CONNECT_TIMEOUT"
      );
    }
    logRouterOsSession("connect_ok", label);
    const result = await fn(api);
    logRouterOsSession("request_done", label);
    return result;
  })();

  try {
    return await Promise.race([operation, watchdog]);
  } catch (err) {
    const normalized = normalizeRouterOsConnectError(err);
    if (!timedOut) {
      logRouterOsSession("request_error", label, {
        error: normalized.message,
        code: normalized instanceof RouterOSConnectError ? normalized.code : undefined,
      });
    }
    throw normalized;
  } finally {
    logRouterOsSession("finally_enter", label, { timedOut });
    if (watchdogTimer !== undefined) {
      clearTimeout(watchdogTimer);
      watchdogTimer = undefined;
    }
    logRouterOsSession("forceDestroy", label);
    api.forceDestroy();
    logRouterOsSession("request_finally", label);
  }
}

/** Alias — preflight sudah terintegrasi di {@link withRouterOsClient}. */
export async function withRouterOsClientPreflight<T>(
  creds: RouterOsCredentials,
  label: string,
  fn: (api: RouterOSClient) => Promise<T>
): Promise<T> {
  return withRouterOsClient(creds, label, fn);
}

/** Wrapper getPPPProfiles: preflight TCP dulu, library hanya jika plain API. */
export async function withRouterOsClientForPppProfiles<T>(
  creds: RouterOsCredentials,
  routerId: number,
  fn: (api: RouterOSClient) => Promise<T>
): Promise<T> {
  const label = `getPPPProfiles:${routerId}`;
  logRouterOsSession("ppp_profiles_wrapper_enter", label, { routerId });
  return withRouterOsClientPreflight(creds, label, fn);
}
