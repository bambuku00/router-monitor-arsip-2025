import net from "node:net";
import { RouterOSConnectError } from "@/lib/routeros-client";
import {
  isUnreachableNetworkCode,
  routerOsConnectTimeoutError,
  routerOsSslRequiredError,
  routerOsUncertainError,
  routerOsUnreachableError,
} from "@/lib/routeros-messages";

export {
  ROUTEROS_AUTH_FAILED_MSG,
  ROUTEROS_PROTOCOL_UNCERTAIN_MSG,
  ROUTEROS_SSL_MISMATCH_MSG,
  ROUTEROS_SSL_REQUIRED_MSG,
  ROUTEROS_UNREACHABLE_MSG,
} from "@/lib/routeros-messages";

/** Batas waktu preflight: connect + kirim probe + tunggu respons (ms). */
export const ROUTEROS_PREFLIGHT_TIMEOUT_MS = 2_000;

export type RouterOsPreflightResult =
  | { ok: true; protocol: "plain" }
  | { ok: false; error: RouterOSConnectError };

/** Deteksi record TLS (handshake/alert/application) versi SSL 3.x+. */
export function looksLikeTlsRecord(chunk: Buffer): boolean {
  if (chunk.length < 2) return false;
  const recordType = chunk[0];
  const versionMajor = chunk[1];
  if (versionMajor !== 0x03) return false;
  return (
    recordType === 0x14 ||
    recordType === 0x15 ||
    recordType === 0x16 ||
    recordType === 0x17
  );
}

/** Encode panjang word RouterOS API (ASCII, word < 0x80). */
function encWordLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  if (length < 0x4000) {
    const v = length | 0x8000;
    return Buffer.from([(v >> 8) & 0xff, v & 0xff]);
  }
  throw new Error("Word too long for preflight probe");
}

function encRouterOsWords(words: string[]): Buffer {
  const parts: Buffer[] = [];
  for (const word of words) {
    const body = Buffer.from(word, "utf8");
    parts.push(encWordLength(body.length), body);
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts as unknown as Uint8Array[]);
}

/**
 * Probe protokol tanpa autentikasi — perintah API sebelum login memicu !trap
 * (mis. "not logged in") tanpa mencatat "login failure" di MikroTik.
 */
export function buildPlainApiProtocolProbe(): Buffer {
  return encRouterOsWords(["/system/identity/print"]);
}

/** Probe tidak boleh memicu login failure di MikroTik. */
export function plainApiProtocolProbeContainsLogin(): boolean {
  return buildPlainApiProtocolProbe().toString("utf8").includes("/login");
}

/** Klasifikasi chunk respons preflight (custom port maupun default). */
export function classifyPreflightDataChunk(chunk: Buffer): RouterOsPreflightResult {
  if (looksLikeTlsRecord(chunk)) {
    return { ok: false, error: routerOsSslRequiredError() };
  }
  if (looksLikeRouterOsApiReply(chunk)) {
    return { ok: true, protocol: "plain" };
  }
  return { ok: false, error: routerOsUncertainError() };
}

/** Timeout preflight: TCP sudah connect → timeout operasi; belum → unreachable. */
export function classifyPreflightTimeout(tcpConnected: boolean): RouterOSConnectError {
  return tcpConnected ? routerOsConnectTimeoutError() : routerOsUnreachableError();
}

/** Baca word pertama dari buffer respons RouterOS API. */
function readFirstRouterOsWord(buf: Buffer): string | null {
  if (buf.length < 1) return null;

  let length = buf[0];
  let offset = 1;

  if (length & 0x80) {
    if ((length & 0xc0) === 0x80) {
      if (buf.length < 2) return null;
      length = ((length & ~0xc0) << 8) + buf[1];
      offset = 2;
    } else if ((length & 0xe0) === 0xc0) {
      if (buf.length < 3) return null;
      length = ((length & ~0xe0) << 16) + (buf[1] << 8) + buf[2];
      offset = 3;
    } else {
      return null;
    }
  }

  if (length === 0 || buf.length < offset + length) return null;
  return buf.subarray(offset, offset + length).toString("utf8");
}

/** Respons diawali !done / !trap / !fatal / !re → plain API terbukti. */
export function looksLikeRouterOsApiReply(chunk: Buffer): boolean {
  if (looksLikeTlsRecord(chunk)) return false;
  const first = readFirstRouterOsWord(chunk);
  if (!first) return false;
  return (
    first === "!done" ||
    first === "!trap" ||
    first === "!fatal" ||
    first === "!re" ||
    first.startsWith("!")
  );
}

/** Tutup socket preflight — selalu dipanggil pada success/error/timeout. */
export function destroyPreflightSocket(socket: net.Socket): void {
  socket.removeAllListeners();
  socket.setTimeout(0);
  socket.destroy();
}

/**
 * Preflight fail-closed: plain API hanya jika probe non-auth memicu respons RouterOS API.
 * Tidak pernah mengirim /login — hindari login failure di log MikroTik.
 */
export function detectRouterOsApiProtocol(
  host: string,
  port: number,
  timeoutMs = ROUTEROS_PREFLIGHT_TIMEOUT_MS
): Promise<RouterOsPreflightResult> {
  return new Promise((resolve) => {
    let settled = false;
    const socket = new net.Socket();
    let hardDeadline: ReturnType<typeof setTimeout> | undefined;
    let probeSent = false;
    let tcpConnected = false;

    const finish = (result: RouterOsPreflightResult) => {
      if (settled) return;
      settled = true;
      if (hardDeadline) clearTimeout(hardDeadline);
      destroyPreflightSocket(socket);
      resolve(result);
    };

    const finishPreflightFailure = (error: RouterOSConnectError) => {
      finish({ ok: false, error });
    };

    hardDeadline = setTimeout(() => {
      finishPreflightFailure(classifyPreflightTimeout(tcpConnected));
    }, timeoutMs);

    socket.setTimeout(timeoutMs);

    socket.once("error", (err: NodeJS.ErrnoException) => {
      if (isUnreachableNetworkCode(err.code)) {
        finishPreflightFailure(routerOsUnreachableError());
        return;
      }
      finishPreflightFailure(routerOsUncertainError());
    });

    socket.once("timeout", () => {
      finishPreflightFailure(classifyPreflightTimeout(tcpConnected));
    });

    socket.on("data", (chunk: Buffer) => {
      finish(classifyPreflightDataChunk(chunk));
    });

    socket.connect(port, host, () => {
      tcpConnected = true;
      if (probeSent) return;
      probeSent = true;
      try {
        socket.write(buildPlainApiProtocolProbe() as unknown as Uint8Array);
      } catch {
        finishPreflightFailure(routerOsUncertainError());
      }
    });
  });
}
