"use server";

import { UserOptionalDefaults } from "@/prisma/generated/zod";
import { User } from "@prisma/client";
import { hash, verify } from "argon2";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { lucia, validateRequest } from "../auth";
import prisma from "../prisma";
import type { BillingStartMode, RoleName } from "@prisma/client";
import {
  normalizeStaffMenuWhitelist,
  staffMenuKeysToPrismaJson,
} from "@/lib/staff-menu-access";
import { sanitizeUserForClient } from "@/lib/api-sanitize";
import { rateLimit } from "@/lib/ratelimit";
import { logSecurityEvent } from "@/lib/security-audit-log";
import {
  parseStaffPelangganScopeBody,
  replaceStaffPelangganScope,
} from "@/lib/staff-pelanggan-scope";
import { logFreeCustomerLimitChanged } from "@/lib/free-customer-quota";
import { normalizePortalSlug, portalSlugError } from "@/lib/portal-slug";
import { getOwnedResourcesUserId } from "@/lib/rbac";

async function parentIdForNewUser(
  actor: {
    id: number;
    role: RoleName;
    parentId?: number | null;
  },
  role: string,
  requested: number | null | undefined
): Promise<{ parentId: number | null } | { error: string; status: number }> {
  if (actor.role === "Admin") {
    return { parentId: getOwnedResourcesUserId(actor) };
  }
  if (role !== "Admin" || requested == null) {
    return { parentId: requested ?? null };
  }
  const parent = await prisma.user.findUnique({
    where: { id: requested },
    select: { role: true, parentId: true },
  });
  if (!parent || parent.role !== "Admin" || parent.parentId != null) {
    return { error: "Mitra induk tidak valid", status: 400 };
  }
  return { parentId: requested };
}

const ARGON2_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Hash dummy (dihitung sekali) untuk menyamakan waktu respons saat username
 * tidak ditemukan — mencegah user enumeration lewat timing side-channel.
 */
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hash("invalid-password-placeholder", ARGON2_OPTS);
  }
  return dummyHashPromise;
}

async function validateUser(username: string, password?: string) {
  if (typeof username !== "string" || !/^[a-z0-9_-]+$/.test(username)) {
    return { error: "Username tidak valid (hanya huruf kecil, angka, _, -)" };
  }
  const existingUser = await prisma.user.findFirst({
    where: { user: username },
  });
  if (existingUser) {
    return { error: "Username sudah digunakan" };
  }
  if (password !== undefined) {
    if (typeof password !== "string" || password.length < 8 || password.length > 255) {
      return { error: "Password tidak valid (minimal 8 karakter)" };
    }
  }
  return null;
}

export async function register(
  data: UserOptionalDefaults
): Promise<User | { error: string; status?: number }> {
  const { user, session } = await validateRequest();

  if (!session || !user) {
    return { error: "Tidak diizinkan", status: 401 };
  }
  if (user.role !== "Superadmin" && user.role !== "Admin") {
    return { error: "Tidak diizinkan", status: 403 };
  }

  const nama = data.nama;
  const username = data.user;
  const role = data.role;

  if (role === "Superadmin") {
    return { error: "Tidak diizinkan", status: 403 };
  }
  if (
    user.role === "Admin" &&
    role !== "Admin" &&
    role !== "Keuangan" &&
    role !== "Teknisi"
  ) {
    return { error: "Tidak diizinkan", status: 403 };
  }

  const validationError = await validateUser(username, data.password);
  if (validationError) return validationError;

  const password = data.password;
  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const parentResolved = await parentIdForNewUser(
    user,
    role,
    data.parentId || null
  );
  if ("error" in parentResolved) return parentResolved;
  const parentId = parentResolved.parentId;
  const isNewRootMitra =
    role === "Admin" && user.role === "Superadmin" && parentId == null;

  let portalCreate: {
    portalPelangganEnabled?: boolean;
    portalSlug?: string | null;
  } = {};
  if (
    isNewRootMitra &&
    (Object.prototype.hasOwnProperty.call(data, "portalPelangganEnabled") ||
      Object.prototype.hasOwnProperty.call(data, "portalSlug"))
  ) {
    const enabled =
      (data as { portalPelangganEnabled?: boolean }).portalPelangganEnabled ===
      true;
    const slug = normalizePortalSlug(
      (data as { portalSlug?: string | null }).portalSlug
    );
    const slugErr = portalSlugError(slug, enabled);
    if (slugErr) return { error: slugErr, status: 400 };
    if (slug) {
      const [takenUser, takenBersama] = await Promise.all([
        prisma.user.findFirst({
          where: { portalSlug: slug },
          select: { id: true },
        }),
        prisma.portalBersama.findFirst({
          where: { slug },
          select: { id: true },
        }),
      ]);
      if (takenUser || takenBersama) {
        return { error: "Link sudah dipakai.", status: 400 };
      }
    }
    portalCreate = { portalPelangganEnabled: enabled, portalSlug: slug };
  }

  const resp = await prisma.user.create({
    data: {
      nama: nama,
      user: username,
      password: passwordHash,
      role: role,
      parentId,
      omset: data.omset ?? null,
      ppn: data.ppn ?? null,
      ...(isNewRootMitra
        ? {
            revenueBasis:
              (data as { revenueBasis?: "INVOICE" | "PAID" }).revenueBasis ??
              "INVOICE",
            billingStartMode: ((data as { billingStartMode?: string })
              .billingStartMode ?? "NEXT_MONTH") as BillingStartMode,
            billingStartDate: (() => {
              const raw = (data as { billingStartDate?: string | Date | null })
                .billingStartDate;
              if (raw == null || raw === "") return null;
              return raw instanceof Date ? raw : new Date(raw);
            })(),
            ...(Object.prototype.hasOwnProperty.call(data, "freeCustomerLimit")
              ? {
                  freeCustomerLimit:
                    (data as { freeCustomerLimit?: number | null })
                      .freeCustomerLimit ?? null,
                }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(data, "pppPackageChangeLimit")
              ? {
                  pppPackageChangeLimit:
                    (data as { pppPackageChangeLimit?: number | null })
                      .pppPackageChangeLimit ?? null,
                }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(data, "pppAutoFillEnabled") &&
            user?.role === "Superadmin"
              ? {
                  pppAutoFillEnabled:
                    (data as { pppAutoFillEnabled?: boolean })
                      .pppAutoFillEnabled === true,
                }
              : {}),
            ...portalCreate,
            ...(Object.prototype.hasOwnProperty.call(data, "ownedByIsp") &&
            user?.role === "Superadmin"
              ? {
                  ownedByIsp:
                    (data as { ownedByIsp?: boolean }).ownedByIsp === true,
                  revenueShareEnabled:
                    (data as { ownedByIsp?: boolean }).ownedByIsp === true
                      ? (data as { revenueShareEnabled?: boolean })
                          .revenueShareEnabled === true
                      : true,
                }
              : {}),
          }
        : {}),
      ...(role === "Teknisi" || role === "Keuangan"
        ? {
            staffMenuKeys: staffMenuKeysToPrismaJson(
              normalizeStaffMenuWhitelist(
                (data as { staffMenuKeys?: unknown }).staffMenuKeys
              )
            ),
            staffAllowBankPayment:
              (data as { staffAllowBankPayment?: boolean }).staffAllowBankPayment !==
              false,
            staffAllowIsolir:
              (data as { staffAllowIsolir?: boolean }).staffAllowIsolir === true,
            staffAllowCancelPayment:
              (data as { staffAllowCancelPayment?: boolean })
                .staffAllowCancelPayment === true,
            staffAllowBerhenti:
              (data as { staffAllowBerhenti?: boolean }).staffAllowBerhenti ===
              true,
          }
        : {}),
    },
  });

  if (
    role === "Admin" &&
    user?.role === "Superadmin" &&
    Object.prototype.hasOwnProperty.call(data, "freeCustomerLimit")
  ) {
    const newLimit =
      (data as { freeCustomerLimit?: number | null }).freeCustomerLimit ?? null;
    if (newLimit !== null) {
      await logFreeCustomerLimitChanged({
        actor: { id: user.id, role: user.role, user: user.user },
        targetUserId: resp.id,
        targetUsername: username,
        oldLimit: null,
        newLimit,
      });
    }
  }

  if (
    (role === "Teknisi" || role === "Keuangan") &&
    parentId != null
  ) {
    const scope = parseStaffPelangganScopeBody(
      (data as { staffPelangganScope?: unknown }).staffPelangganScope
    );
    if (scope !== null) {
      try {
        await replaceStaffPelangganScope(resp.id, scope, parentId);
      } catch (scopeErr) {
        const msg = scopeErr instanceof Error ? scopeErr.message : String(scopeErr);
        console.error("replaceStaffPelangganScope on register:", msg);
      }
    }
  }

  const { password: _, ...userWithoutPassword } = resp;
  return userWithoutPassword as User;
}

export async function registerPageAction(
  data: UserOptionalDefaults
): Promise<User | { error: string; status?: number }> {
  const { user, session } = await validateRequest();

  if (!session || !user) {
    return { error: "Tidak diizinkan", status: 401 };
  }
  if (user.role !== "Superadmin" && user.role !== "Admin") {
    return { error: "Tidak diizinkan", status: 403 };
  }

  const role = data.role;
  if (role === "Superadmin") {
    return { error: "Tidak diizinkan", status: 403 };
  }
  if (
    user.role === "Admin" &&
    role !== "Admin" &&
    role !== "Keuangan" &&
    role !== "Teknisi"
  ) {
    return { error: "Tidak diizinkan", status: 403 };
  }

  const nama = data.nama;
  const username = data.user;

  const validationError = await validateUser(username, data.password);
  if (validationError) return validationError;

  const password = data.password;
  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const resp = await prisma.user.create({
    data: {
      nama: nama,
      user: username,
      password: passwordHash,
      alamat: data.alamat,
      identitas: "NIK",
      no_identitas: data.no_identitas,
      file_identitas: data.file_identitas,
      role,
      ...((role === "Teknisi" ||
        role === "Keuangan" ||
        (role === "Admin" && user.role === "Admin"))
        ? { parentId: getOwnedResourcesUserId(user) }
        : {}),
    },
  });

  const { password: _, ...userWithoutPassword } = resp;
  return userWithoutPassword as User;
}

/** Internal only — jangan di-export (file "use server"). */
function getAuditClientIpFromHeaders(hdrs: Headers): string {
  const trustForwardHeaders =
    process.env.TRUST_FORWARD_HEADERS === "true" ||
    process.env.TRUST_FORWARD_HEADERS === "1";

  if (trustForwardHeaders) {
    // Prefer X-Real-IP (set by Nginx real_ip / trusted proxy), not cf-connecting-ip:
    // clients hitting origin directly can spoof CF-Connecting-IP.
    const realIp = hdrs.get("x-real-ip")?.trim();
    if (realIp) return realIp;

    const forwarded = hdrs.get("x-forwarded-for");
    const first = forwarded?.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

/** IP + User-Agent untuk security audit (login/logout). Rate limit memakai request-ip terpisah. */
function getClientRequestContextFromHeaders(hdrs: Headers): {
  auditIp: string;
  userAgent: string | null;
} {
  return {
    auditIp: getAuditClientIpFromHeaders(hdrs),
    userAgent: hdrs.get("user-agent"),
  };
}

async function getClientRequestContext(): Promise<{
  auditIp: string;
  userAgent: string | null;
}> {
  return getClientRequestContextFromHeaders(await headers());
}

export async function logout() {
  const { session, user } = await validateRequest();
  if (!session) {
    return {
      error: "Unauthorized",
    };
  }
  const { auditIp, userAgent } = await getClientRequestContext();
  const cookiesStore = await cookies();

  await lucia.invalidateSession(session.id);
  await lucia.deleteExpiredSessions();

  logSecurityEvent({
    action: "logout",
    outcome: "success",
    ip: auditIp,
    userAgent,
    endpoint: "server-action:logout",
    userId: user?.id,
    username: user?.user,
  });

  const sessionCookie = lucia.createBlankSessionCookie();
  cookiesStore.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes
  );
  return null;
}

export async function login(
  data: Pick<UserOptionalDefaults, "user" | "password">,
  options?: { onlyPetugas?: boolean }
): Promise<{ user: User | null; error?: string }> {
  const username = data.user;
  const errorString = "Username atau password salah";
  const hdrs = await headers();
  const { getTrustedClientIpFromHeaders } = await import("@/lib/request-ip");
  const rateLimitIp = getTrustedClientIpFromHeaders(hdrs);
  const { auditIp, userAgent } = getClientRequestContextFromHeaders(hdrs);

  // Defense in depth: rate limit even when login dipanggil sebagai server action (bypass /api/auth).
  if (rateLimit(`login:${rateLimitIp}`, 5, 60_000)) {
    logSecurityEvent({
      action: "login",
      outcome: "rate_limited",
      ip: auditIp,
      userAgent,
      endpoint: "server-action:login",
      username: typeof username === "string" ? username : undefined,
    });
    return {
      user: null,
      error: "Terlalu banyak percobaan. Coba lagi dalam satu menit.",
    };
  }
  if (
    typeof username === "string" &&
    rateLimit(`login-user:${username.toLowerCase()}`, 20, 3_600_000)
  ) {
    logSecurityEvent({
      action: "login",
      outcome: "rate_limited",
      ip: auditIp,
      userAgent,
      endpoint: "server-action:login",
      username,
      reason: "per-username hourly",
    });
    return {
      user: null,
      error: "Terlalu banyak percobaan. Coba lagi nanti.",
    };
  }

  if (
    typeof username !== "string" ||
    username.length < 3 ||
    username.length > 31 ||
    !/^[a-z0-9_-]+$/.test(username)
  ) {
    logSecurityEvent({
      action: "login",
      outcome: "failed",
      ip: auditIp,
      userAgent,
      endpoint: "server-action:login",
      reason: "invalid_username_format",
    });
    return {
      user: null,
      error: errorString,
    };
  }
  const password = data.password;
  if (typeof password !== "string" || password.length > 255) {
    logSecurityEvent({
      action: "login",
      outcome: "failed",
      ip: auditIp,
      userAgent,
      endpoint: "server-action:login",
      username,
      reason: "invalid_password_format",
    });
    return {
      user: null,
      error: errorString,
    };
  }

  const existingUser = await prisma.user.findFirst({
    where: { user: username },
  });
  if (!existingUser) {
    // Timing equalization: jalankan verify terhadap hash dummy agar waktu respons
    // untuk "user tidak ada" setara dengan "password salah" (anti enumeration).
    try {
      await verify(await getDummyHash(), password);
    } catch {}
    logSecurityEvent({
      action: "login",
      outcome: "failed",
      ip: auditIp,
      userAgent,
      endpoint: "server-action:login",
      username,
      reason: "user_not_found",
    });
    return {
      user: null,
      error: errorString,
    };
  }

  const validPassword = await verify(existingUser.password, password);
  if (!validPassword) {
    logSecurityEvent({
      action: "login",
      outcome: "failed",
      ip: auditIp,
      userAgent,
      endpoint: "server-action:login",
      username,
      userId: existingUser.id,
      reason: "bad_password",
    });
    return {
      user: null,
      error: errorString,
    };
  }

  if (existingUser.role === "Petugas") {
    const penagihAkun = await prisma.penagih.findFirst({
      where: { userId: existingUser.id, aktif: true },
      select: { id: true },
    });
    if (existingUser.disabled || !penagihAkun) {
      logSecurityEvent({
        action: "login",
        outcome: "denied",
        ip: auditIp,
        userAgent,
        endpoint: "server-action:login",
        username,
        userId: existingUser.id,
        reason: "disabled",
      });
      return {
        user: null,
        error: "Akun petugas nonaktif. Hubungi admin.",
      };
    }
  }

  if (options?.onlyPetugas && existingUser.role !== "Petugas") {
    logSecurityEvent({
      action: "login",
      outcome: "denied",
      ip: auditIp,
      userAgent,
      endpoint: "server-action:login",
      username,
      userId: existingUser.id,
      reason: "not_petugas",
    });
    return {
      user: null,
      error: "Halaman ini hanya untuk akun petugas.",
    };
  }

  if (!existingUser.verified) {
    logSecurityEvent({
      action: "login",
      outcome: "denied",
      ip: auditIp,
      userAgent,
      endpoint: "server-action:login",
      username,
      userId: existingUser.id,
      reason: "unverified",
    });
    return {
      user: null,
      error: "User belum diverifikasi harap hubungi admin",
    };
  }
  await createSessionForUser(existingUser.id);
  logSecurityEvent({
    action: "login",
    outcome: "success",
    ip: auditIp,
    userAgent,
    endpoint: "server-action:login",
    username,
    userId: existingUser.id,
  });
  return { user: sanitizeUserForClient(existingUser) as User };
}

export async function checkSession() {
  const session = await validateRequest();

  if (!session.user) return redirect("/login");
}

/** Internal only — jangan di-export (file "use server" = export = callable dari client). */
async function createSessionForUser(userId: number) {
  const cookiesStore = await cookies();
  const session = await lucia.createSession(userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookiesStore.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes
  );
}
