import { validateRequest } from "@/lib/auth";
import { canAccessUser, hasRole } from "@/lib/rbac";
import {
  listStaffAssignmentForPelanggan,
  syncPelangganStaffAssignment,
} from "@/lib/staff-pelanggan-scope";
import { errorApiResponse } from "@/lib/server-actions/api";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PutBodySchema = z.object({
  staffUserIds: z.array(z.number().int().positive()),
});

async function resolvePelangganMitra(pelangganId: number) {
  return prisma.pelanggan.findUnique({
    where: { id: pelangganId },
    select: {
      id: true,
      router: { select: { userId: true } },
    },
  });
}

export async function GET(
  _: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
    }

    if (!hasRole(user, ["Superadmin", "Admin"])) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
    }

    const params = await segmentData.params;
    const pelangganId = params.id ? parseInt(params.id, 10) : NaN;
    if (!Number.isFinite(pelangganId)) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    const pelanggan = await resolvePelangganMitra(pelangganId);
    const mitraUserId = pelanggan?.router?.userId;
    if (!pelanggan || mitraUserId == null) {
      return NextResponse.json({ error: "Pelanggan tidak ditemukan" }, { status: 404 });
    }

    if (user.role !== "Superadmin" && !canAccessUser(user, mitraUserId)) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
    }

    const data = await listStaffAssignmentForPelanggan(pelangganId, mitraUserId);
    return NextResponse.json({ data });
  } catch (err) {
    return errorApiResponse(err);
  }
}

export async function PUT(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
    }

    if (user.role !== "Superadmin" && user.role !== "Admin") {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
    }

    const params = await segmentData.params;
    const pelangganId = params.id ? parseInt(params.id, 10) : NaN;
    if (!Number.isFinite(pelangganId)) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    const pelanggan = await resolvePelangganMitra(pelangganId);
    const mitraUserId = pelanggan?.router?.userId;
    if (!pelanggan || mitraUserId == null) {
      return NextResponse.json({ error: "Pelanggan tidak ditemukan" }, { status: 404 });
    }

    if (user.role !== "Superadmin" && !canAccessUser(user, mitraUserId)) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
    }

    const raw = (await request.json()) as unknown;
    const parsed = PutBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    await syncPelangganStaffAssignment(
      pelangganId,
      parsed.data.staffUserIds,
      mitraUserId
    );

    const data = await listStaffAssignmentForPelanggan(pelangganId, mitraUserId);
    return NextResponse.json({
      data,
      message: "Penugasan staff berhasil disimpan",
    });
  } catch (err) {
    return errorApiResponse(err);
  }
}
