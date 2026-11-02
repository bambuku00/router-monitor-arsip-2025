"use server";

import { logger } from "@/lib/logger";

import { validateRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { canAccessPembukuan, isMitraStaff } from "@/lib/pembukuan-scope";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

// List Pengeluaran with pagination and search
export async function getPengeluaranList(
  page: number = 1,
  pageSize: number = 10,
  query?: string,
  year?: number,
  month?: number,
  userId?: number
) {
  const { user } = await validateRequest();
  if (!user || !canAccessPembukuan(user)) {
    return { error: "Unauthorized" };
  }

  // Admin & staff mitra: pengeluaran milik mitra induk.
  // Keuangan / lainnya: paksa scope sendiri (abaikan userId dari client kecuali Superadmin).
  if (user.role === "Admin" || isMitraStaff(user)) {
    userId = getOwnedResourcesUserId(user);
  } else if (user.role === "Superadmin") {
    // Superadmin boleh filter by userId opsional
  } else {
    userId = user.id;
  }

  try {
    const skip = (page - 1) * pageSize;
    const where: Prisma.PengeluaranWhereInput = {};
    
    if (userId) {
        where.userId = userId;
    }

    if (query) {
      where.OR = [
        { keterangan: { contains: query } },
      ];
    }

    // Filter by Date
    if (year) {
        if (month && month > 0) {
            // Specific month
            where.tanggal = {
                gte: new Date(year, month - 1, 1),
                lt: new Date(year, month, 1)
            };
        } else {
            // Whole year
            where.tanggal = {
                gte: new Date(year, 0, 1),
                lt: new Date(year + 1, 0, 1)
            };
        }
    }

    const [data, total] = await Promise.all([
      prisma.pengeluaran.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { tanggal: "desc" },
      }),
      prisma.pengeluaran.count({ where }),
    ]);

    return { data, total, page, pageSize };
  } catch (err) {
    logger.error({ msg: "Error fetching pengeluaran list", error: (err as Error).message });
    return { error: "Gagal mengambil data pengeluaran" };
  }
}

// Create
export async function createPengeluaran(formData: {
  keterangan: string;
  nominal: number;
  tanggal: Date;
  userId?: number;
}) {
  const { user } = await validateRequest();
  if (!user || !canAccessPembukuan(user)) {
    return { error: "Unauthorized" };
  }

  // Non-Superadmin tidak boleh override userId dari client.
  const ownerUserId =
    user.role === "Superadmin" && formData.userId != null
      ? formData.userId
      : user.role === "Admin" || isMitraStaff(user)
        ? getOwnedResourcesUserId(user)
        : user.id;

  try {
    await prisma.pengeluaran.create({
      data: {
        keterangan: formData.keterangan,
        nominal: formData.nominal,
        tanggal: formData.tanggal,
        userId: ownerUserId,
      },
    });
    revalidatePath("/pembukuan", "layout");
    return { success: true };
  } catch (err) {
    logger.error({ msg: "Error creating pengeluaran", error: (err as Error).message });
    return { error: "Gagal menambahkan pengeluaran" };
  }
}

// Update
export async function updatePengeluaran(
  id: number,
  formData: {
    keterangan: string;
    nominal: number;
    tanggal: Date;
  }
) {
  const { user } = await validateRequest();
  if (!user || !canAccessPembukuan(user)) {
    return { error: "Unauthorized" };
  }

  try {
    const existing = await prisma.pengeluaran.findUnique({
        where: { id },
        select: { userId: true }
    });

    if (!existing) return { error: "Data tidak ditemukan" };

    const ownerUserId =
      user.role === "Admin" || isMitraStaff(user)
        ? getOwnedResourcesUserId(user)
        : user.id;

    if (user.role !== "Superadmin" && existing.userId !== ownerUserId) {
      return { error: "Unauthorized access to this resource" };
    }

    await prisma.pengeluaran.update({
      where: { id },
      data: {
        keterangan: formData.keterangan,
        nominal: formData.nominal,
        tanggal: formData.tanggal,
      },
    });
    revalidatePath("/pembukuan", "layout");
    return { success: true };
  } catch (err) {
    logger.error({ msg: "Error updating pengeluaran", error: (err as Error).message });
    return { error: "Gagal mengupdate pengeluaran" };
  }
}

// Delete
export async function deletePengeluaran(id: number) {
  const { user } = await validateRequest();
  if (!user || !canAccessPembukuan(user)) {
    return { error: "Unauthorized" };
  }

  try {
    const existing = await prisma.pengeluaran.findUnique({
        where: { id },
        select: { userId: true }
    });

    if (!existing) return { error: "Data tidak ditemukan" };

    const ownerUserId =
      user.role === "Admin" || isMitraStaff(user)
        ? getOwnedResourcesUserId(user)
        : user.id;

    if (user.role !== "Superadmin" && existing.userId !== ownerUserId) {
      return { error: "Unauthorized access to this resource" };
    }

    await prisma.pengeluaran.delete({
      where: { id },
    });
    revalidatePath("/pembukuan", "layout");
    return { success: true };
  } catch (err) {
    logger.error({ msg: "Error deleting pengeluaran", error: (err as Error).message });
    return { error: "Gagal menghapus pengeluaran" };
  }
}
