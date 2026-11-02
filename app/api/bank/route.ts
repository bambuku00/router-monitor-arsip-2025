import { validateRequest } from "@/lib/auth";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { canListMitraBanks } from "@/lib/staff-menu-access";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import {
  BankOptionalDefaults,
  BankOptionalDefaultsSchema as BankSchema,
} from "@/prisma/generated/zod";
import { RoleName } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });

    if (!canListMitraBanks(user)) {
      return NextResponse.json(
        { error: "Akses menu ditolak untuk akun ini." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");

    let json = [];
    if (user.role === "Superadmin") {
      if (role) {
        json = await prisma.bank.findMany({
          where: {
            user: {
              role: role as RoleName,
            },
          },
        });
      } else {
        json = await prisma.bank.findMany();
      }
    } else {
      json = await prisma.bank.findMany({
        where: {
          userId: getOwnedResourcesUserId(user),
          deleted: false,
        },
        orderBy: { bank: "asc" },
      });
    }
    return NextResponse.json({
      data: json,
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "GET bank error", error: error.message });
    return NextResponse.json(error.message, { status: 400 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });

    const deniedPost = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (deniedPost) return deniedPost;

    const data = (await request.json()) as BankOptionalDefaults | null;
    const parseSchema = BankSchema.safeParse(data);
    if (!data || !parseSchema.success)
      return NextResponse.json("Data is not valid", { status: 400 });
    
    // SECURITY: Override userId for non-Superadmin users
    if (user.role !== "Superadmin") {
      data.userId = getOwnedResourcesUserId(user);
    } else if (data.userId) {
      // Superadmin can assign owner, but validate userId exists
      const targetUser = await prisma.user.findUnique({
        where: { id: data.userId },
      });
      if (!targetUser) {
        return NextResponse.json("Target user not found", { status: 400 });
      }
    } else {
      // If Superadmin doesn't specify userId, use their own
      data.userId = user.id;
    }
    
    const post = await prisma.bank.create({
      data: data,
    });
    return NextResponse.json({
      data: post,
      message: "Bank berhasil disimpan",
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "POST bank error", error: error.message });
    return NextResponse.json(error.message, { status: 400 });
  }
}
