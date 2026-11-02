import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import { errorApiResponse } from "@/lib/server-actions/api";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const session = await validateRequest();
    if (!session.user)
      return NextResponse.json("Unauthorized", { status: 401 });
    return NextResponse.json({
      data: session,
      message: "Berhasil mendapatkan session",
    });
  } catch (err) {
    return errorApiResponse(err);
  }
}
