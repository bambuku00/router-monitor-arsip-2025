import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { env } from "@/lib/env";

function timingSafeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(
    new Uint8Array(ba.buffer, ba.byteOffset, ba.byteLength),
    new Uint8Array(bb.buffer, bb.byteOffset, bb.byteLength)
  );
}

/** Cocokkan `Authorization: Bearer <token>` dengan CRON_SECRET (timing-safe). */
export function verifyCronRequest(request: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    return timingSafeCompare(secret, token);
  }

  return false;
}
