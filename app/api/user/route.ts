import { validateRequest } from "@/lib/auth";
import { register } from "@/lib/server-actions/auth-actions";
import { errorApiResponse } from "@/lib/server-actions/api";
import {
  UserOptionalDefaults,
  UserOptionalDefaultsSchema as UserSchema,
} from "@/prisma/generated/zod";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session)
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
    const data = (await request.json()) as UserOptionalDefaults | null;
    const parseSchema = UserSchema.safeParse(data);
    if (!data || !parseSchema.success)
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    if (
      user.role !== "Superadmin" &&
      user.role !== "Admin"
    )
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
    if (user.role !== "Superadmin" && data.role === "Superadmin")
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
    const post = await register(data);
    if ("error" in post && post.error)
      return NextResponse.json(
        { error: post.error },
        { status: post.status || 400 }
      );
    return NextResponse.json({
      data: post,
      message: "User berhasil disimpan",
    });
  } catch (err) {
    return errorApiResponse(err);
  }
}
