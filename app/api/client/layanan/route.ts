import { validateRequest } from "@/lib/auth";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import {
  LayananOptionalDefaults,
  LayananOptionalDefaultsSchema as LayananSchema,
} from "@/prisma/generated/zod";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session) return new Response(null, { status: 401 });
    const data = (await request.json()) as LayananOptionalDefaults | null;
    const parseSchema = LayananSchema.safeParse(data);
    if (!data || !parseSchema.success)
      return NextResponse.json("Data is not valid", { status: 400 });
    
    // SECURITY: Verify client ownership before creating layanan
    const client = await prisma.client.findFirst({
      where: { 
        id: data.clientId,
        userId: user.role === "Superadmin" ? undefined : user.id,
      },
    });
    
    if (!client) {
      return NextResponse.json("Client not found or access denied", { status: 403 });
    }
    
    const post = await prisma.layanan.create({
      data: data,
    });
    return NextResponse.json({
      data: post,
      message: "Layanan berhasil disimpan",
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "POST client/layanan error", error: error.message });
    return NextResponse.json(error.message, { status: 400 });
  }
}
