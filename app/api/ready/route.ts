import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Readiness: siap menerima traffic bila DB terjangkau. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ready", db: "up", timestamp: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    // Jangan bocorkan detail error DB ke client.
    return NextResponse.json(
      { status: "not_ready", db: "down", timestamp: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
