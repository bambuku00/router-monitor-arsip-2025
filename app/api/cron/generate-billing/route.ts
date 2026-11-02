import { NextResponse, type NextRequest } from "next/server";

import { verifyCronRequest } from "@/lib/cron-auth";
import {
  CRON_GENERATE_BILLING_ERROR_MESSAGE,
  executeCronGenerateBilling,
} from "@/lib/cron/generate-billing-service";
import { isCronSecretConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleGenerateBilling(request);
}

export async function POST(request: NextRequest) {
  return handleGenerateBilling(request);
}

export async function HEAD(request: NextRequest) {
  return handleGenerateBilling(request);
}

async function handleGenerateBilling(request: NextRequest) {
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
    const result = await executeCronGenerateBilling();
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ msg: "Cron generate billing error", error: err });
    return NextResponse.json(
      { error: CRON_GENERATE_BILLING_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}
