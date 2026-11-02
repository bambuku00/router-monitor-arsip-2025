"use client";

import { useEffect } from "react";

const NEXT_NOT_FOUND = "NEXT_NOT_FOUND";

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    (err as { digest?: string }).digest === NEXT_NOT_FOUND
  );
}

/** redirect()/permanentRedirect() throw this; Next handles it — React still logs in dev. */
function isNextRedirectNoise(err: unknown): boolean {
  if (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: string }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT;")
  ) {
    return true;
  }
  return err instanceof Error && err.message === "NEXT_REDIRECT";
}

function shouldSuppressDevNavigationNoise(args: unknown[]): boolean {
  for (const a of args) {
    if (isNotFoundError(a)) return true;
    if (isNextRedirectNoise(a)) return true;
  }
  return false;
}

/**
 * In dev, React/Next may call console.error with caught navigation errors
 * (NEXT_NOT_FOUND, NEXT_REDIRECT) — noisy stack traces though behavior is correct.
 * Production: no-op (patch not applied).
 */
export default function DevConsoleNotFoundGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || typeof window === "undefined")
      return;
    const orig = window.console.error;
    window.console.error = function (...args: unknown[]) {
      if (shouldSuppressDevNavigationNoise(args)) {
        window.console.debug(
          "Navigation / not-found handled by Next.js (expected in dev)."
        );
        return;
      }
      orig.apply(window.console, args);
    };
    return () => {
      window.console.error = orig;
    };
  }, []);
  return null;
}
