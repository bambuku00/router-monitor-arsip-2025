import { validateRequest } from "@/lib/auth";
import {
  getOrCreateAppSettings,
  validateBillingGenerateDay,
  validateBillingGenerateHour,
} from "@/lib/billing-generate-config";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SettingsSchema = z.object({
  billingGenerateDay: z.number().int().min(1).max(28),
  billingGenerateHour: z.number().int().min(0).max(23),
});

export async function GET() {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  if (user.role !== "Superadmin") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const settings = await getOrCreateAppSettings();
  return NextResponse.json({ data: settings });
}

export async function PATCH(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  if (user.role !== "Superadmin") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const parsed = SettingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const dayErr = validateBillingGenerateDay(parsed.data.billingGenerateDay);
  const hourErr = validateBillingGenerateHour(parsed.data.billingGenerateHour);
  if (dayErr || hourErr) {
    return NextResponse.json({ error: dayErr ?? hourErr }, { status: 400 });
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json({
    data: settings,
    message: "Pengaturan billing disimpan",
  });
}
