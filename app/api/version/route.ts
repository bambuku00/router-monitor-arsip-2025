import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Informasi versi/build (tanpa secret) untuk Guardian / observabilitas.
 * Sumber: env yang di-set saat build/deploy (opsional).
 */
export function GET() {
  return NextResponse.json(
    {
      name: "router-monitor",
      version: process.env.npm_package_version ?? process.env.APP_VERSION ?? "unknown",
      commit: process.env.GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
      buildTime: process.env.BUILD_TIME ?? "unknown",
      env: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
