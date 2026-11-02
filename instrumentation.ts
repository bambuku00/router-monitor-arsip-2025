/**
 * Dev-only: Next.js implements redirect() by throwing an error with digest NEXT_REDIRECT.
 * React still emits console.error / overlay noise even though navigation succeeds.
 */
export async function register() {
  if (process.env.NODE_ENV !== "development") return;

  const g = globalThis as typeof globalThis & {
    __nextRedirectConsolePatched?: boolean;
  };
  if (g.__nextRedirectConsolePatched) return;
  g.__nextRedirectConsolePatched = true;

  const orig = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    for (const a of args) {
      if (
        typeof a === "object" &&
        a !== null &&
        "digest" in a &&
        typeof (a as { digest?: string }).digest === "string" &&
        (a as { digest: string }).digest.startsWith("NEXT_REDIRECT;")
      ) {
        return;
      }
      if (a instanceof Error && a.message === "NEXT_REDIRECT") return;
    }
    orig(...args);
  };
}
