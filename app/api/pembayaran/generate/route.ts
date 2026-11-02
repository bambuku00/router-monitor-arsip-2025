import { NextResponse, type NextRequest } from "next/server";

import { verifyCronRequest } from "@/lib/cron-auth";
import { isCronSecretConfigured } from "@/lib/env";
import { runScheduledBillingGenerate } from "@/lib/jobs/generate-payments";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Cron / VPS / Vercel: generate tagihan bulan berjalan (zona Asia/Jakarta di job). Tetap ada juga trigger manual Superadmin. */
export async function GET(request: NextRequest) {
  return handleGenerate(request);
}

export async function POST(request: NextRequest) {
  return handleGenerate(request);
}

export async function HEAD(request: NextRequest) {
  return handleGenerate(request);
}

/** @deprecated Gunakan /api/cron/generate-billing — tetap dipanggil untuk kompatibilitas cron lama. */
async function handleGenerate(request: NextRequest) {
  if (!isCronSecretConfigured()) {
    return NextResponse.json(
      { error: "CRON_SECRET belum di-set di server." },
      { status: 503 }
    );
  }

  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledBillingGenerate();
    logger.info({ msg: "Generate tagihan (cron legacy)", result });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ msg: "Generate tagihan (cron) error", error: err });
    return NextResponse.json(
      { error: "Gagal generate tagihan." },
      { status: 500 }
    );
  }
}
