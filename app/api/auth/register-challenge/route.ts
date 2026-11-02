import { issueRegisterChallenge } from "@/lib/register-challenge";
import { rateLimit } from "@/lib/ratelimit";
import { getTrustedClientIp } from "@/lib/request-ip";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const ip = getTrustedClientIp(request);
  if (rateLimit(`reg-challenge:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  try {
    const challenge = issueRegisterChallenge();
    return NextResponse.json({ data: challenge });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Challenge unavailable" },
      { status: 503 }
    );
  }
}
