import { lucia, validateRequest } from "@/lib/auth";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { errorApiResponse } from "@/lib/server-actions/api";
import { sanitizeObject } from "@/lib/security";
import { UserPutSchema, RevenueBasisSchema } from "@/lib/user-put-schema";
import { hasRole, canAdminDeleteOwnStaff, canManageUserAccount } from "@/lib/rbac";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import {
  canEditStaffMenuKeys,
  normalizeStaffMenuWhitelist,
  reconcileStaffMenuKeys,
  staffMenuKeysToPrismaJson,
} from "@/lib/staff-menu-access";
import {
  parseStaffPelangganScopeBody,
  replaceStaffPelangganScope,
} from "@/lib/staff-pelanggan-scope";
import { logFreeCustomerLimitChanged } from "@/lib/free-customer-quota";
import { lockedBersamaForMitra } from "@/lib/pelanggan-portal";
import { normalizePortalSlug, portalSlugError } from "@/lib/portal-slug";
import { hash } from "argon2";
import type { Prisma, RevenueBasis } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

function parseRevenueBasis(value: unknown): RevenueBasis | undefined {
  const r = RevenueBasisSchema.safeParse(value);
  return r.success ? r.data : undefined;
}

export async function PUT(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user)
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
    const rawBody = (await request.json()) as Record<string, unknown> | null;
    const raw = rawBody ? sanitizeObject(rawBody) : null;
    const parseSchema = UserPutSchema.safeParse(raw);
    const params = await segmentData.params;
    if (!raw || !params.id || !parseSchema.success) {
      return NextResponse.json(
        {
          error: "Data tidak valid",
          details: parseSchema.success ? undefined : parseSchema.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parseSchema.data;
    const targetId = parseInt(params.id);

    if (!(await canManageUserAccount(user, targetId)))
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });

    // Menu-key gate hanya untuk mutasi akun ORANG LAIN (mis. Admin mengubah staff-nya).
    // Self-service (ubah profil/password sendiri) tidak boleh dibatasi oleh whitelist menu "users".
    if (targetId !== user.id) {
      const forbidden = staffMenuApiForbidden(user, request.nextUrl?.pathname ?? "");
      if (forbidden) return forbidden;
    }

    const existing = await prisma.user.findUnique({ where: { id: targetId } });
    if (!existing)
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

    if (data.role && data.role !== existing.role) {
      if (hasRole(user, "Superadmin")) {
        // Superadmin boleh ubah role apa pun
      } else if (user.role === "Admin") {
        const staffRoles = data.role === "Teknisi" || data.role === "Keuangan";
        const targetIsStaff =
          existing.role === "Teknisi" || existing.role === "Keuangan";
        if (!staffRoles || !targetIsStaff) {
          return NextResponse.json(
            { error: "Tidak diizinkan mengubah role" },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Tidak diizinkan mengubah role" },
          { status: 403 }
        );
      }
    }

    if (
      data.parentId != null &&
      data.parentId !== existing.parentId &&
      !hasRole(user, "Superadmin")
    ) {
      return NextResponse.json(
        { error: "Tidak diizinkan mengubah parentId" },
        { status: 403 }
      );
    }

    if (
      raw != null &&
      Object.prototype.hasOwnProperty.call(raw, "pppAutoFillEnabled") &&
      !hasRole(user, "Superadmin")
    ) {
      return NextResponse.json(
        { error: "Tidak diizinkan mengubah pengaturan Auto Fill" },
        { status: 403 }
      );
    }

    const portalSelf =
      user.role === "Admin" &&
      user.id === existing.id &&
      existing.role === "Admin";
    const touchesPortal =
      raw != null &&
      (Object.prototype.hasOwnProperty.call(raw, "portalPelangganEnabled") ||
        Object.prototype.hasOwnProperty.call(raw, "portalSlug"));
    if (touchesPortal && !hasRole(user, "Superadmin") && !portalSelf) {
      return NextResponse.json(
        { error: "Tidak diizinkan mengubah Portal Pelanggan" },
        { status: 403 }
      );
    }
    if (touchesPortal && portalSelf) {
      const locked = await lockedBersamaForMitra(existing.id);
      if (locked.length > 0) {
        return NextResponse.json(
          {
            error:
              "Pengaturan portal dikunci karena link bersama sudah dihidupkan.",
          },
          { status: 403 }
        );
      }
    }

    const menuPatch =
      (existing.role === "Teknisi" || existing.role === "Keuangan") &&
      canEditStaffMenuKeys(user, existing) &&
      data.staffMenuKeys !== undefined
        ? {
            staffMenuKeys: staffMenuKeysToPrismaJson(
              (() => {
                const wl = normalizeStaffMenuWhitelist(data.staffMenuKeys);
                return wl === null ? null : reconcileStaffMenuKeys(wl);
              })()
            ),
          }
        : {};

    const revenueBasis =
      parseRevenueBasis(data.revenueBasis) ??
      parseRevenueBasis(raw.revenueBasis);
    const isAdminMitra =
      existing.role === "Admin" && existing.parentId == null;
    const hasRevenueBasisInBody =
      raw != null && Object.prototype.hasOwnProperty.call(raw, "revenueBasis");

    const adminMitraPatch: Prisma.UserUncheckedUpdateInput =
      hasRole(user, "Superadmin") && isAdminMitra
        ? {
            ...(hasRevenueBasisInBody
              ? { revenueBasis: revenueBasis ?? "INVOICE" }
              : revenueBasis !== undefined
                ? { revenueBasis }
                : {}),
            ...(data.billingStartMode != null
              ? { billingStartMode: data.billingStartMode }
              : {}),
            ...(data.billingStartDate !== undefined
              ? {
                  billingStartDate:
                    data.billingStartDate == null
                      ? null
                      : data.billingStartDate instanceof Date
                        ? data.billingStartDate
                        : new Date(String(data.billingStartDate)),
                }
              : {}),
            ...(raw != null &&
            Object.prototype.hasOwnProperty.call(raw, "billingGenerateDay")
              ? {
                  billingGenerateDay:
                    data.billingGenerateDay == null
                      ? null
                      : data.billingGenerateDay,
                }
              : {}),
            ...(raw != null &&
            Object.prototype.hasOwnProperty.call(raw, "freeCustomerLimit")
              ? {
                  freeCustomerLimit:
                    data.freeCustomerLimit == null
                      ? null
                      : data.freeCustomerLimit,
                }
              : {}),
            ...(raw != null &&
            Object.prototype.hasOwnProperty.call(raw, "pppPackageChangeLimit")
              ? {
                  pppPackageChangeLimit:
                    data.pppPackageChangeLimit == null
                      ? null
                      : data.pppPackageChangeLimit,
                }
              : {}),
            ...(raw != null &&
            Object.prototype.hasOwnProperty.call(raw, "pppAutoFillEnabled")
              ? {
                  pppAutoFillEnabled: data.pppAutoFillEnabled === true,
                }
              : {}),
            ...(raw != null &&
            Object.prototype.hasOwnProperty.call(raw, "ownedByIsp")
              ? {
                  ownedByIsp: data.ownedByIsp === true,
                  revenueShareEnabled:
                    data.ownedByIsp === true
                      ? data.revenueShareEnabled === true
                      : true,
                }
              : {}),
          }
        : {};

    let portalPatch: Prisma.UserUncheckedUpdateInput = {};
    if (
      raw != null &&
      touchesPortal &&
      ((hasRole(user, "Superadmin") && isAdminMitra) || portalSelf)
    ) {
      const enabled = Object.prototype.hasOwnProperty.call(
        raw,
        "portalPelangganEnabled"
      )
        ? data.portalPelangganEnabled === true
        : existing.portalPelangganEnabled === true;
      const slug = Object.prototype.hasOwnProperty.call(raw, "portalSlug")
        ? normalizePortalSlug(data.portalSlug)
        : normalizePortalSlug(existing.portalSlug);
      const slugErr = portalSlugError(slug, enabled);
      if (slugErr) {
        return NextResponse.json({ error: slugErr }, { status: 400 });
      }
      if (slug) {
        const [takenUser, takenBersama] = await Promise.all([
          prisma.user.findFirst({
            where: { portalSlug: slug, NOT: { id: targetId } },
            select: { id: true },
          }),
          prisma.portalBersama.findFirst({
            where: { slug },
            select: { id: true },
          }),
        ]);
        if (takenUser || takenBersama) {
          return NextResponse.json(
            { error: "Link sudah dipakai." },
            { status: 400 }
          );
        }
      }
      portalPatch = {
        ...(Object.prototype.hasOwnProperty.call(raw, "portalPelangganEnabled")
          ? { portalPelangganEnabled: enabled }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(raw, "portalSlug")
          ? { portalSlug: slug }
          : {}),
      };
    }

    const password = data.password?.trim();
    const staffPatch =
      (existing.role === "Teknisi" || existing.role === "Keuangan") &&
      canEditStaffMenuKeys(user, existing)
        ? {
            ...(data.staffAllowBankPayment !== undefined
              ? { staffAllowBankPayment: data.staffAllowBankPayment !== false }
              : {}),
            ...(data.staffAllowIsolir !== undefined
              ? { staffAllowIsolir: data.staffAllowIsolir === true }
              : {}),
            ...(data.staffAllowCancelPayment !== undefined
              ? {
                  staffAllowCancelPayment:
                    data.staffAllowCancelPayment === true,
                }
              : {}),
            ...(data.staffAllowBerhenti !== undefined
              ? { staffAllowBerhenti: data.staffAllowBerhenti === true }
              : {}),
          }
        : {};

    let userData: Prisma.UserUncheckedUpdateInput = {
      nama: data.nama,
      user: data.user,
      ...(data.omset !== undefined ? { omset: data.omset } : {}),
      ...(data.ppn !== undefined ? { ppn: data.ppn } : {}),
      ...(data.role ? { role: data.role } : {}),
      ...(hasRole(user, "Superadmin") && data.parentId
        ? { parentId: data.parentId }
        : {}),
      ...adminMitraPatch,
      ...portalPatch,
      ...menuPatch,
      ...staffPatch,
    };

    if (password) {
      const existingUser = await prisma.user.findFirst({
        where: { user: data.user },
      });
      if (existingUser && existingUser.id !== targetId) {
        return NextResponse.json({ error: "Username sudah digunakan" }, { status: 400 });
      }
      userData.password = await hash(password, {
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
    } else {
      const existingUser = await prisma.user.findFirst({
        where: { user: data.user },
      });
      if (existingUser && existingUser.id !== targetId) {
        return NextResponse.json({ error: "Username sudah digunakan" }, { status: 400 });
      }
    }

    const passwordChanged = Boolean(password);

    // H2: password update + session wipe must be atomic.
    // If either fails, the transaction rolls back → no stale sessions, no lockout.
    // Lucia sessions live in the same DB (Prisma adapter), so deleteMany is equivalent
    // to invalidateUserSessions and participates in the transaction.
    let resp;
    let sessionRecreateFailed = false;
    if (passwordChanged) {
      resp = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: targetId },
          data: userData,
        });
        await tx.session.deleteMany({ where: { userId: targetId } });
        return updated;
      });

      // Self-change only: issue a fresh session after the wipe committed.
      // Failure here is availability-only (password already changed, old sessions dead).
      if (targetId === user.id) {
        try {
          const newSession = await lucia.createSession(targetId, {});
          const sessionCookie = lucia.createSessionCookie(newSession.id);
          const cookiesStore = await cookies();
          cookiesStore.set(
            sessionCookie.name,
            sessionCookie.value,
            sessionCookie.attributes
          );
        } catch (sessionErr) {
          sessionRecreateFailed = true;
          console.error(
            "createSession after password change failed:",
            sessionErr instanceof Error ? sessionErr.message : sessionErr
          );
        }
      }
    } else {
      resp = await prisma.user.update({
        where: { id: targetId },
        data: userData,
      });
    }

    const { password: _p, ...userWithoutPassword } = resp;

    const mayEditPelangganScope =
      (existing.role === "Teknisi" || existing.role === "Keuangan") &&
      canEditStaffMenuKeys(user, existing) &&
      data.staffPelangganScope !== undefined;
    if (mayEditPelangganScope && existing.parentId != null) {
      const scope = parseStaffPelangganScopeBody(data.staffPelangganScope);
      const existingScopeCount = await prisma.staffPelangganScope.count({
        where: { staffUserId: targetId },
      });
      const shouldWriteScope =
        scope !== null || existingScopeCount > 0;

      if (shouldWriteScope) {
        try {
          await replaceStaffPelangganScope(
            targetId,
            scope,
            existing.parentId
          );
        } catch (scopeErr) {
          const msg = scopeErr instanceof Error ? scopeErr.message : String(scopeErr);
          console.error("replaceStaffPelangganScope on user update:", msg);
          return NextResponse.json({
            data: userWithoutPassword,
            message:
              "User diperbarui, tetapi batas pelanggan PPP gagal disimpan. Jalankan migrasi database terbaru.",
            warning: msg,
          });
        }
      }
    }

    const hadFreeLimitInBody =
      raw != null &&
      Object.prototype.hasOwnProperty.call(raw, "freeCustomerLimit");
    if (
      hadFreeLimitInBody &&
      hasRole(user, "Superadmin") &&
      isAdminMitra
    ) {
      const newLimit = data.freeCustomerLimit ?? null;
      if (existing.freeCustomerLimit !== newLimit) {
        await logFreeCustomerLimitChanged({
          actor: { id: user.id, role: user.role, user: user.user },
          targetUserId: existing.id,
          targetUsername: existing.user,
          oldLimit: existing.freeCustomerLimit,
          newLimit,
        });
      }
    }

    return NextResponse.json({
      data: userWithoutPassword,
      message: sessionRecreateFailed
        ? "User berhasil diperbarui. Password berubah; silakan login ulang."
        : "User berhasil diperbarui",
      ...(sessionRecreateFailed
        ? { warning: "Sesi baru gagal dibuat; login ulang diperlukan." }
        : {}),
    });
  } catch (err) {
    return errorApiResponse(err);
  }
}

export async function DELETE(
  _: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
    }
    const params = await segmentData.params;
    if (!params.id) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const targetId = parseInt(params.id);
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true, parentId: true },
    });
    if (!target) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const mayDelete =
      hasRole(user, "Superadmin") || canAdminDeleteOwnStaff(user, target);
    if (!mayDelete) {
      return NextResponse.json(
        { error: "Tidak diizinkan menghapus user ini" },
        { status: 403 }
      );
    }

    const { cascadedRemoveUser } = await import("@/lib/delete-user-cascade");
    const outcome = await cascadedRemoveUser(user.id, targetId);

    if ("error" in outcome) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    return NextResponse.json({ message: outcome.message });
  } catch (err) {
    return errorApiResponse(err);
  }
}
