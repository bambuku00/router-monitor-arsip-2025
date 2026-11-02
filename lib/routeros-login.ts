import { createHash } from "node:crypto";

/**
 * Hitung atribut `=response=` untuk login challenge RouterOS (6.43+).
 * MD5(0x00 + password_utf8 + ret_bytes), diawali prefix `00`.
 */
export function computeRouterOsLoginResponse(
  password: string,
  retHex: string
): string {
  const challenge = Buffer.from(retHex, "hex");
  const blob = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(password, "utf8"),
    challenge,
  ] as unknown as Uint8Array[]);
  return `00${createHash("md5").update(blob).digest("hex")}`;
}

export type RouterOsLoginResponse = {
  status?: boolean;
  ret?: string;
  message?: string;
};

export type ParsedRouterOsLoginResult =
  | { kind: "success" }
  | { kind: "challenge"; ret: string }
  | { kind: "auth_failed"; message?: string }
  | { kind: "malformed" };

/** Ekstrak field dari respons object library @winet/routeros-client. */
export function parseRouterOsLoginFields(result: unknown): RouterOsLoginResponse {
  if (!result || typeof result !== "object") return {};
  const obj = result as Record<string, unknown>;
  const retRaw = typeof obj.ret === "string" ? obj.ret.trim() : "";
  return {
    ret: retRaw || undefined,
    status: typeof obj.status === "boolean" ? obj.status : undefined,
    message: typeof obj.message === "string" ? obj.message : undefined,
  };
}

/** @deprecated Gunakan {@link parseRouterOsLoginFields}. */
export function extractRouterOsLoginRet(result: unknown): RouterOsLoginResponse {
  return parseRouterOsLoginFields(result);
}

/** Trap `/login` yang benar-benar menandakan kredensial salah. */
export function isRouterOsLoginAuthTrapMessage(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("cantlogin") ||
    lower.includes("invalid user name or password") ||
    lower.includes("invalid username or password") ||
    lower.includes("wrong username or password") ||
    lower.includes("authentication failure") ||
    lower.includes("authentication failed")
  );
}

/**
 * Interpretasi respons `/login`:
 * - `ret` ada → lanjut challenge-response
 * - `!done` tanpa `ret` → sukses
 * - `!trap` autentikasi → auth_failed
 */
export function parseRouterOsLoginResponse(result: unknown): ParsedRouterOsLoginResult {
  const { status, ret, message } = parseRouterOsLoginFields(result);

  if (ret) {
    return { kind: "challenge", ret };
  }

  if (status === false) {
    if (isRouterOsLoginAuthTrapMessage(message)) {
      return { kind: "auth_failed", message };
    }
    return { kind: "malformed" };
  }

  if (status === true) {
    return { kind: "success" };
  }

  return { kind: "malformed" };
}

export function buildDirectLoginSentences(user: string, password: string): string[] {
  return ["/login", `=name=${user}`, `=password=${password}`];
}

export function buildChallengeLoginSentences(
  user: string,
  response: string
): string[] {
  return ["/login", `=name=${user}`, `=response=${response}`];
}
