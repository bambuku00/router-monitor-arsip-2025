import RouterClient from "@winet/routeros-client";
import { logRouterOsSession } from "@/lib/routeros-log";
import {
  computeRouterOsLoginResponse,
  buildChallengeLoginSentences,
  buildDirectLoginSentences,
  parseRouterOsLoginResponse,
} from "@/lib/routeros-login";
import { parseRouterIdFromLabel } from "@/lib/routeros-ports";
import {
  ROUTEROS_PROTOCOL_UNCERTAIN_MSG,
  isConnectionClosedCode,
  isRouterOsAuthFailure,
  isUnreachableNetworkCode,
  routerOsAuthFailedError,
  routerOsConnectionClosedError,
  routerOsMalformedResponseError,
  routerOsSslRequiredError,
  routerOsUnreachableError,
} from "@/lib/routeros-messages";

type RouterOSOptions = {
  host: string;
  port?: number | null;
  user: string;
  password: string;
};

type RouterOSCommand = string | string[];
type RouterOSData = string[] | undefined;

type SocketLike = {
  setTimeout?(ms: number): void;
  destroy?(): void;
  once?(event: string, fn: (...args: unknown[]) => void): void;
  on?(event: string, fn: (...args: unknown[]) => void): void;
  removeListener?(event: string, fn: (...args: unknown[]) => void): void;
  off?(event: string, fn: (...args: unknown[]) => void): void;
  removeAllListeners?(event?: string): void;
};

type ReceiveEmitter = {
  on?(event: string, fn: (...args: unknown[]) => void): void;
  once?(event: string, fn: (...args: unknown[]) => void): void;
  removeListener?(event: string, fn: (...args: unknown[]) => void): void;
  off?(event: string, fn: (...args: unknown[]) => void): void;
  sendSentencesAsync?(sentences?: string[]): Promise<unknown>;
  sendSentences?(sentences?: string[]): void;
};

/** Default batas waktu connect + idle socket (ms). */
export const ROUTEROS_DEFAULT_TIMEOUT_MS = 5_000;

/** Socket yang sudah punya swallow-error handler (hindari on('error') berulang). */
const socketsWithSwallowError = new WeakSet<object>();

export class RouterOSConnectError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "RouterOSConnectError";
    this.code = code;
  }
}

function extractReplies(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (
    result &&
    typeof result === "object" &&
    "replies" in result &&
    Array.isArray(result.replies)
  )
    return result.replies;
  if (result && typeof result === "object" && "replies" in result && result.replies)
    return [result.replies];
  return [];
}

function findTrapMessage(replies: unknown[]): string | null {
  for (const reply of replies) {
    if (!reply) continue;

    if (typeof reply === "string") {
      const lower = reply.toLowerCase();
      if (lower.includes("!trap") || lower.includes("trap") || lower.includes("cantlogin")) {
        return reply;
      }
      continue;
    }

    if (typeof reply === "object") {
      const anyReply = reply as Record<string, unknown>;

      const type = typeof anyReply.type === "string" ? anyReply.type : undefined;
      const replyType = typeof anyReply.reply === "string" ? anyReply.reply : undefined;
      const category = typeof anyReply.category === "string" ? anyReply.category : undefined;

      const message =
        (typeof anyReply.message === "string" && anyReply.message) ||
        (typeof anyReply.msg === "string" && anyReply.msg) ||
        (typeof anyReply.error === "string" && anyReply.error) ||
        (typeof (anyReply as { attrs?: { message?: string } }).attrs?.message === "string" &&
          (anyReply as { attrs: { message: string } }).attrs.message) ||
        null;

      const kind = (type || replyType || category || "").toLowerCase();
      const msgLower = (message || "").toLowerCase();

      if (kind.includes("trap") || msgLower.includes("cantlogin")) {
        return message || "RouterOS trap";
      }
    }
  }
  return null;
}

/** Deteksi plain API ke port API-SSL (TLS) atau sebaliknya. */
export function normalizeRouterOsConnectError(err: unknown): Error {
  if (err instanceof RouterOSConnectError) return err;

  const e = err instanceof Error ? err : new Error(String(err));
  const nodeErr = e as NodeJS.ErrnoException;
  const code = nodeErr.code ?? "";
  const msg = e.message.toLowerCase();

  if (
    code === "ROUTEROS_CONNECT_TIMEOUT" ||
    code === "ROUTEROS_SOCKET_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    msg.includes("habis waktu") ||
    (msg.includes("timeout") && msg.includes("routeros"))
  ) {
    return new RouterOSConnectError(
      `Koneksi RouterOS habis waktu. Periksa host, port, dan protokol API (biasa vs SSL).`,
      "ROUTEROS_CONNECT_TIMEOUT"
    );
  }

  if (
    code === "ERR_SSL_WRONG_VERSION_NUMBER" ||
    code === "ERR_SSL_PACKET_LENGTH_TOO_LONG" ||
    code === "ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION" ||
    msg.includes("wrong version number") ||
    msg.includes("ssl routines") ||
    (msg.includes("0x16 0x03") && msg.includes("ssl")) ||
    (msg.includes("packet length too long") && msg.includes("ssl"))
  ) {
    return routerOsSslRequiredError();
  }

  if (code === "ROUTEROS_UNREACHABLE" || isUnreachableNetworkCode(code)) {
    return routerOsUnreachableError();
  }

  if (
    code === "ROUTEROS_CONNECTION_CLOSED" ||
    isConnectionClosedCode(code) ||
    msg.includes("socket hang up") ||
    msg.includes("connection reset")
  ) {
    return routerOsConnectionClosedError();
  }

  if (
    code === "ROUTEROS_PROTOCOL_UNCERTAIN" ||
    msg.includes("protocol mismatch") ||
    msg.includes("unexpected token") ||
    msg.includes("invalid header")
  ) {
    return new RouterOSConnectError(
      ROUTEROS_PROTOCOL_UNCERTAIN_MSG,
      "ROUTEROS_PROTOCOL_UNCERTAIN"
    );
  }

  if (code === "ROUTEROS_MALFORMED_RESPONSE") {
    return routerOsMalformedResponseError();
  }

  if (isRouterOsAuthFailure(e)) {
    return routerOsAuthFailedError();
  }

  return e;
}

/** Cegah uncaughtException jika library emit error socket tanpa listener. */
function swallowSocketErrors(socket: SocketLike): void {
  if (socketsWithSwallowError.has(socket as object)) return;
  const handler = () => undefined;
  socket.on?.("error", handler);
  socketsWithSwallowError.add(socket as object);
}

/**
 * Library @winet/routeros-client menambah `on('receive')` setiap perintah
 * tanpa remove → MaxListenersExceededWarning. Ganti ke once + cleanup.
 */
function patchClientReceiveOnce(client: ReceiveEmitter): void {
  if (typeof client.sendSentencesAsync !== "function") return;
  if ((client as { __receiveOncePatched?: boolean }).__receiveOncePatched) return;

  client.sendSentencesAsync = function sendSentencesAsyncPatched(
    sentences: string[] = []
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const onReceive = (result: unknown) => {
        cleanup();
        resolve(result);
      };
      const onError = (err: unknown) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        client.removeListener?.("receive", onReceive);
        client.off?.("receive", onReceive);
        const sock = (client as { socket?: SocketLike }).socket;
        if (sock && onError) {
          sock.removeListener?.("error", onError);
          sock.off?.("error", onError);
        }
      };
      try {
        client.once?.("receive", onReceive);
        const sock = (client as { socket?: SocketLike }).socket;
        sock?.once?.("error", onError);
        client.sendSentences?.(sentences);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  };

  (client as { __receiveOncePatched?: boolean }).__receiveOncePatched = true;
}

export class RouterOSClient {
  private client: ReturnType<typeof RouterClient.createClient>;
  private user: string;
  private password: string;
  private connectionTimeoutMs = ROUTEROS_DEFAULT_TIMEOUT_MS;
  private logLabel = "routeros";
  private boundSocket: SocketLike | null = null;
  /** Handler stabil — didaftarkan sekali per socket, tidak diganti tiap poll. */
  private socketErrorHandler: ((err: unknown) => void) | null = null;
  private socketTimeoutHandler: (() => void) | null = null;
  private connectErrorCallback: ((err: Error) => void) | null = null;
  private connected = false;
  private connectAborted = false;

  constructor(options: RouterOSOptions) {
    this.user = options.user;
    this.password = options.password;
    this.client = RouterClient.createClient({
      host: options.host,
      port: options.port ?? 8728,
      debug: false,
    });
    patchClientReceiveOnce(this.client as ReceiveEmitter);
  }

  private getSocket(): SocketLike | undefined {
    return (this.client as { socket?: SocketLike }).socket;
  }

  private detachSocketHandlers(): void {
    const socket = this.boundSocket;
    if (socket && this.socketErrorHandler) {
      socket.removeListener?.("error", this.socketErrorHandler);
      socket.off?.("error", this.socketErrorHandler);
    }
    if (socket && this.socketTimeoutHandler) {
      socket.removeListener?.("timeout", this.socketTimeoutHandler);
      socket.off?.("timeout", this.socketTimeoutHandler);
    }
    this.boundSocket = null;
    this.socketErrorHandler = null;
    this.socketTimeoutHandler = null;
    this.connectErrorCallback = null;
  }

  /**
   * Pasang listener timeout/error tepat sekali per socket.
   * Poll connect hanya memperbarui idle timeout + callback, tanpa addListener baru.
   */
  private bindSocketHandlers(
    socket: SocketLike,
    timeoutMs: number,
    onError?: (err: Error) => void
  ): void {
    if (onError) this.connectErrorCallback = onError;

    if (this.boundSocket === socket && this.socketTimeoutHandler) {
      socket.setTimeout?.(timeoutMs);
      return;
    }

    this.detachSocketHandlers();
    if (onError) this.connectErrorCallback = onError;
    this.boundSocket = socket;
    socket.setTimeout?.(timeoutMs);

    this.socketTimeoutHandler = () => {
      socket.destroy?.();
      this.connectErrorCallback?.(
        new RouterOSConnectError(
          `Socket RouterOS idle timeout (${timeoutMs} ms)`,
          "ROUTEROS_SOCKET_TIMEOUT"
        )
      );
    };
    // `on` + remove eksplisit di detach — jangan once+rebind berulang saat poll.
    socket.on?.("timeout", this.socketTimeoutHandler);

    this.socketErrorHandler = (err: unknown) => {
      this.connectErrorCallback?.(normalizeRouterOsConnectError(err));
    };
    socket.on?.("error", this.socketErrorHandler);
    swallowSocketErrors(socket);
  }

  setLogLabel(label: string): void {
    this.logLabel = label;
  }

  setSocketTimeout(ms: number): void {
    this.connectionTimeoutMs = ms;
    const socket = this.getSocket();
    if (socket) this.bindSocketHandlers(socket, ms);
  }

  /** Aktifkan idle timeout socket selama operasi API agar write tidak menggantung. */
  private ensureOperationTimeout(): void {
    const socket = this.getSocket();
    if (socket && this.connected) {
      this.bindSocketHandlers(socket, this.connectionTimeoutMs);
    }
  }

  private sessionLogMeta(stage: string, extra?: Record<string, unknown>) {
    return {
      routerId: parseRouterIdFromLabel(this.logLabel),
      stage,
      connectionType: "plain",
      ...extra,
    };
  }

  private async sendRawSentences(sentences: string[]): Promise<Record<string, unknown>> {
    const client = this.client as ReceiveEmitter;
    if (typeof client.sendSentencesAsync !== "function") {
      throw new Error("RouterOS client missing sendSentencesAsync");
    }
    const result = await client.sendSentencesAsync(sentences);
    return result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  }

  /**
   * Login RouterOS: direct name/password dulu (modern), challenge hanya jika `ret`.
   */
  private async performLogin(): Promise<void> {
    logRouterOsSession(
      "login_direct_start",
      this.logLabel,
      this.sessionLogMeta("login_direct_start", { attempt: 1 })
    );

    let directResult: Record<string, unknown>;
    try {
      directResult = await this.sendRawSentences(
        buildDirectLoginSentences(this.user, this.password)
      );
    } catch (err) {
      throw normalizeRouterOsConnectError(err);
    }

    const directParsed = parseRouterOsLoginResponse(directResult);

    if (directParsed.kind === "success") {
      logRouterOsSession(
        "login_ok",
        this.logLabel,
        this.sessionLogMeta("login_ok", { attempt: 1, method: "direct" })
      );
      return;
    }

    if (directParsed.kind === "auth_failed") {
      throw routerOsAuthFailedError();
    }

    if (directParsed.kind === "malformed") {
      throw routerOsMalformedResponseError();
    }

    logRouterOsSession(
      "login_challenge_response",
      this.logLabel,
      this.sessionLogMeta("login_challenge_response", { attempt: 2 })
    );

    const response = computeRouterOsLoginResponse(
      this.password,
      directParsed.ret
    );

    let challengeResult: Record<string, unknown>;
    try {
      challengeResult = await this.sendRawSentences(
        buildChallengeLoginSentences(this.user, response)
      );
    } catch (err) {
      throw normalizeRouterOsConnectError(err);
    }

    const challengeParsed = parseRouterOsLoginResponse(challengeResult);

    if (challengeParsed.kind === "success") {
      logRouterOsSession(
        "login_ok",
        this.logLabel,
        this.sessionLogMeta("login_ok", { attempt: 2, method: "challenge" })
      );
      return;
    }

    if (challengeParsed.kind === "auth_failed") {
      throw routerOsAuthFailedError();
    }

    throw routerOsMalformedResponseError();
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connectAborted) {
      throw new RouterOSConnectError(
        "Koneksi RouterOS dibatalkan",
        "ROUTEROS_CONNECT_TIMEOUT"
      );
    }

    const timeoutMs = this.connectionTimeoutMs;
    let socketPoll: ReturnType<typeof setInterval> | undefined;
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    const clearTimers = () => {
      if (socketPoll) clearInterval(socketPoll);
      if (connectTimer) clearTimeout(connectTimer);
      socketPoll = undefined;
      connectTimer = undefined;
    };

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimers();
      fn();
    };

    try {
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          socketPoll = setInterval(() => {
            if (this.connectAborted) {
              settle(() =>
                reject(
                  new RouterOSConnectError(
                    "Koneksi RouterOS dibatalkan",
                    "ROUTEROS_CONNECT_TIMEOUT"
                  )
                )
              );
              return;
            }
            const socket = this.getSocket();
            if (socket) {
              this.bindSocketHandlers(socket, timeoutMs, (err) => {
                settle(() => reject(err));
              });
            }
          }, 50);

          void this.performLogin()
            .then(() => {
              if (this.connectAborted) {
                settle(() =>
                  reject(
                    new RouterOSConnectError(
                      "Koneksi RouterOS dibatalkan setelah login",
                      "ROUTEROS_CONNECT_TIMEOUT"
                    )
                  )
                );
                return;
              }
              settle(resolve);
            })
            .catch((err: unknown) =>
              settle(() => reject(normalizeRouterOsConnectError(err)))
            );
        }),
        new Promise<void>((_, reject) => {
          connectTimer = setTimeout(() => {
            settle(() => {
              this.connectAborted = true;
              logRouterOsSession("timeout", this.logLabel, {
                timeoutMs,
                source: "connect",
              });
              this.forceDestroy();
              reject(
                new RouterOSConnectError(
                  `Koneksi RouterOS habis waktu (${timeoutMs} ms). Periksa host, port, dan protokol API (biasa vs SSL).`,
                  "ROUTEROS_CONNECT_TIMEOUT"
                )
              );
            });
          }, timeoutMs);
        }),
      ]);

      if (this.connectAborted) {
        throw new RouterOSConnectError(
          "Koneksi RouterOS dibatalkan",
          "ROUTEROS_CONNECT_TIMEOUT"
        );
      }

      this.connected = true;
      this.connectErrorCallback = null;
      const socket = this.getSocket();
      if (socket) {
        // Pertahankan / pasang ulang handler idle untuk operasi berikutnya.
        this.bindSocketHandlers(socket, timeoutMs);
      }
    } catch (err) {
      this.connected = false;
      this.forceDestroy();
      throw normalizeRouterOsConnectError(err);
    } finally {
      clearTimers();
      // Jangan detach di sukses — idle timeout masih dibutuhkan write().
      if (!this.connected) {
        this.detachSocketHandlers();
      }
    }
  }

  async close(): Promise<void> {
    this.connected = false;
    try {
      this.client.close?.();
    } catch {
      /* ignore */
    } finally {
      this.forceDestroy();
    }
  }

  forceDestroy(): void {
    this.connectAborted = true;
    logRouterOsSession("forceDestroy", this.logLabel);
    this.connected = false;
    this.detachSocketHandlers();
    try {
      const socket = this.getSocket();
      if (socket) {
        swallowSocketErrors(socket);
        socket.removeAllListeners?.();
        socket.setTimeout?.(0);
        socket.destroy?.();
      }
      this.client.close?.();
    } catch {
      /* ignore */
    }
  }

  private async writeFromSegments(segments: string[]): Promise<unknown[]> {
    this.ensureOperationTimeout();
    if (segments.length === 0) return [];
    const [command, ...rest] = segments;
    let builder = this.client.command(command);

    const attrs: Record<string, string> = {};
    const equals: { name: string; value: string }[] = [];

    for (const segment of rest) {
      if (typeof segment !== "string" || segment.length === 0) continue;
      if (segment.startsWith("?")) {
        const idx = segment.indexOf("=", 1);
        if (idx === -1) continue;
        const name = segment.slice(1, idx);
        const value = segment.slice(idx + 1);
        if (!name) continue;
        equals.push({ name, value });
      } else if (segment.startsWith("=")) {
        const idx = segment.indexOf("=", 1);
        if (idx === -1) continue;
        const name = segment.slice(1, idx);
        const value = segment.slice(idx + 1);
        if (!name) continue;
        attrs[name] = value;
      }
    }

    if (Object.keys(attrs).length > 0) {
      builder = builder.setAttrs(attrs);
    }
    for (const eq of equals) {
      builder = builder.equal(eq.name, eq.value);
    }

    const result = await builder.get();
    const replies = extractReplies(result);
    const trapMessage = findTrapMessage(replies);
    if (trapMessage) {
      if (trapMessage.toLowerCase().includes("cantlogin")) {
        throw routerOsAuthFailedError();
      }
      throw new Error(trapMessage);
    }
    return replies;
  }

  async write(command: RouterOSCommand, data?: RouterOSData): Promise<unknown[]> {
    this.ensureOperationTimeout();
    if (Array.isArray(command)) {
      return this.writeFromSegments(command);
    }

    if (Array.isArray(data) && data.length > 0) {
      const segments = [command, ...data];
      return this.writeFromSegments(segments);
    }

    const result = await this.client.command(command).get();
    const replies = extractReplies(result);
    const trapMessage = findTrapMessage(replies);
    if (trapMessage) {
      if (trapMessage.toLowerCase().includes("cantlogin")) {
        throw routerOsAuthFailedError();
      }
      throw new Error(trapMessage);
    }
    return replies;
  }

  async torch(interfaceName: string): Promise<unknown[]> {
    this.ensureOperationTimeout();
    const result = await this.client
      .command("/tool/torch")
      .setAttrs({ interface: interfaceName })
      .get();
    const replies = extractReplies(result);
    const trapMessage = findTrapMessage(replies);
    if (trapMessage) {
      if (trapMessage.toLowerCase().includes("cantlogin")) {
        throw routerOsAuthFailedError();
      }
      throw new Error(trapMessage);
    }
    return replies;
  }

  async getInterfaceStats(interfaceName: string): Promise<unknown[]> {
    return this.write("/interface/print", ["=stats=", "?name=" + interfaceName]);
  }
}
