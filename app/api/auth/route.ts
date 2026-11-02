import { errorApiResponse } from "@/lib/server-actions/api";
import { login } from "@/lib/server-actions/auth-actions";
import { rateLimit } from "@/lib/ratelimit";
import { getTrustedClientIp } from "@/lib/request-ip";
import { logSecurityEvent } from "@/lib/security-audit-log";
import { UserOptionalDefaults } from "@/prisma/generated/zod";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const ip = getTrustedClientIp(request);
    const userAgent = request.headers.get("user-agent");
    if (rateLimit(ip, 5, 60000)) {
      logSecurityEvent({
        action: "login",
        outcome: "rate_limited",
        ip,
        userAgent,
        endpoint: "/api/auth",
      });
      return NextResponse.json("Too many requests, please try again later", {
        status: 429,
      });
    }

    const data = (await request.json()) as UserOptionalDefaults | null;
    if (!data || Object.keys(data).length === 0)
      return NextResponse.json("Data is not valid", { status: 400 });
    const post = await login(data);
    if ("error" in post && post.error) {
      if (post.error === "Unauthorized")
        return NextResponse.json(post.error, { status: 401 });
      return NextResponse.json(post.error, { status: 400 });
    }
    return NextResponse.json({
      data: post,
      message: "Berhasil login",
    });
  } catch (err) {
    const error = err as Error;
    return errorApiResponse(error);
  }
}
