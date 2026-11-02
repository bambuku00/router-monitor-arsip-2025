/** Strip credential-like substrings from sync error messages before persisting/logging. */
export function sanitizePppSyncError(message: string): string {
  let out = message.slice(0, 500);
  out = out.replace(/password[=:\s][^\s,;]+/gi, "password=[redacted]");
  out = out.replace(/CANTLOGIN[^\s]*/gi, "AUTH_FAILED");
  return out.trim();
}
