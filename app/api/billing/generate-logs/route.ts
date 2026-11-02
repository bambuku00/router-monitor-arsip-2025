import { validateRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  if (user.role !== "Superadmin") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "30", 10)));
  const period = request.nextUrl.searchParams.get("period") || undefined;
  const status = request.nextUrl.searchParams.get("status") || undefined;
  const mitraUserIdParam = request.nextUrl.searchParams.get("mitraUserId");

  const where = {
    ...(period ? { period } : {}),
    ...(status ? { status: status as "success" | "failed" | "skipped" } : {}),
    ...(mitraUserIdParam
      ? { userId: parseInt(mitraUserIdParam, 10) }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.billingGenerateLog.findMany({
      where,
      include: { user: { select: { id: true, nama: true } } },
      orderBy: { generatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.billingGenerateLog.count({ where }),
  ]);

  return NextResponse.json({
    data: rows.map((r) => ({
      id: r.id,
      mitraUserId: r.userId,
      mitraNama: r.user.nama,
      period: r.period,
      status: r.status,
      invoiceCount: r.invoiceCount,
      message: r.message,
      generatedAt: r.generatedAt.toISOString(),
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
}
