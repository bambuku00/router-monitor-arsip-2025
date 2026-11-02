import { errorApiResponse } from "@/lib/server-actions/api";
import { logout } from "@/lib/server-actions/auth-actions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const post = await logout();
    if (post && "error" in post && post.error)
      return NextResponse.json(post.error, { status: 400 });
    return NextResponse.json({
      data: post,
      message: "Berhasil keluar",
    });
  } catch (err) {
    const error = err as Error;
    return errorApiResponse(error);
  }
}
