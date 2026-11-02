import { NextResponse, type NextRequest } from "next/server";

import { verifyCronRequest } from "@/lib/cron-auth";
import {
  CRON_AUTO_ISOLIR_ERROR_MESSAGE,
  executeCronAutoIsolir,
} from "@/lib/cron/auto-isolir-service";
import { isCronSecretConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleAutoIsolir(request);
}

export async function POST(request: NextRequest) {
  return handleAutoIsolir(request);
}

export async function HEAD(request: NextRequest) {
  return handleAutoIsolir(request);
}

async function handleAutoIsolir(request: NextRequest) {
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
    const result = await executeCronAutoIsolir();
    if (!result.ok) {
      return NextResponse.json(result, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ msg: "Auto isolir cron error", error: err });
    return NextResponse.json(
      { error: CRON_AUTO_ISOLIR_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}
