import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness: proses hidup. Tidak menyentuh DB, tidak membocorkan secret. */
export function GET() {
  return NextResponse.json(
    { status: "ok", uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
