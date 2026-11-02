import type { User } from "lucia";
import { NextResponse } from "next/server";

import { canAccessApiPath } from "@/lib/route-access";

/**
 * Pemanggilan setelah user terautentikasi. Mengembalikan 403 jika Teknisi/Keuangan
 * tidak punya kunci menu untuk API ini.
 */
export function staffMenuApiForbidden(
  user: User,
  pathname: string
): NextResponse | null {
  if (!canAccessApiPath(user, pathname)) {
    return NextResponse.json(
      { error: "Akses menu ditolak untuk akun ini." },
      { status: 403 }
    );
  }
  return null;
}

/** Untuk handler yang memakai `Request` biasa (ambil pathname dari `request.url`). */
export function staffMenuApiForbiddenFromRequestUrl(
  user: User,
  requestUrl: string
): NextResponse | null {
  try {
    return staffMenuApiForbidden(user, new URL(requestUrl).pathname);
  } catch {
    return null;
  }
}
