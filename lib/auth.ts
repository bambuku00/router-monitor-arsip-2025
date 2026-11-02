import { Lucia, TimeSpan } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { cookies } from "next/headers";
import prisma from "./prisma";
import { logger } from "./logger";
import { User } from "lucia";
import { Session } from "lucia";
import { Prisma, RoleName } from "@prisma/client";

/** Production defaults to Secure cookies (HTTPS only). Browser will ignore them on plain HTTP — set SESSION_COOKIE_SECURE=false on .env if you serve over HTTP (e.g. IP:port without TLS). Prefer HTTPS in production. */
function sessionCookieSecure(): boolean {
  const v = process.env.SESSION_COOKIE_SECURE;
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return process.env.NODE_ENV === "production";
}

const adapter = new PrismaAdapter(prisma.session, prisma.user);

export const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(1, "d"),
  sessionCookie: {
    expires: true,
    attributes: {
      secure: sessionCookieSecure(),
      sameSite: "lax", // Reduce CSRF: cookie not sent on cross-site POSTs
    },
  },
  getUserAttributes: (attributes) => {
    return {
      id: attributes.id,
      nama: attributes.nama,
      user: attributes.user,
      parentId: attributes.parentId,
      role: attributes.role,
      ppn: attributes.ppn,
      staffMenuKeys: attributes.staffMenuKeys ?? null,
      staffAllowBankPayment: attributes.staffAllowBankPayment ?? true,
      staffAllowIsolir: attributes.staffAllowIsolir === true,
      staffAllowCancelPayment: attributes.staffAllowCancelPayment === true,
      staffAllowBerhenti: attributes.staffAllowBerhenti === true,
    };
  },
});

export type SessionLucia =
  | { user: User; session: Session }
  | {
      user: null;
      session: null;
    };
export const validateRequest = async (): Promise<SessionLucia> => {
  const cookiesStore = await cookies();
  const sessionId = cookiesStore.get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) {
    return {
      user: null,
      session: null,
    };
  }

  try {
    const result = await lucia.validateSession(sessionId);

    // next.js throws when you attempt to set cookie when rendering page
    try {
      if (result.session && result.session.fresh) {
        const sessionCookie = lucia.createSessionCookie(result.session.id);
        cookiesStore.set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes
        );
      }
      if (!result.session) {
        const sessionCookie = lucia.createBlankSessionCookie();
        cookiesStore.set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes
        );
      }
    } catch {}
    return result;
  } catch (err) {
    const now = Date.now();
    const last =
      (globalThis as { __validateRequestDbErrLog?: number })
        .__validateRequestDbErrLog ?? 0;
    if (now - last > 90_000) {
      (globalThis as { __validateRequestDbErrLog?: number }).__validateRequestDbErrLog =
        now;
      logger.error({
        msg: "validateRequest: database unreachable or session lookup failed (log di-throttle 90s)",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    try {
      const sessionCookie = lucia.createBlankSessionCookie();
      cookiesStore.set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes
      );
    } catch {}
    return {
      user: null,
      session: null,
    };
  }
};

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      id: number;
      nama: string;
      user: string;
      parentId?: number;
      role: RoleName;
      ppn: number | null;
      staffMenuKeys: Prisma.JsonValue | null;
      staffAllowBankPayment: boolean | null;
      staffAllowIsolir: boolean | null;
      staffAllowCancelPayment: boolean | null;
      staffAllowBerhenti: boolean | null;
    };
    UserId: number;
  }
}
