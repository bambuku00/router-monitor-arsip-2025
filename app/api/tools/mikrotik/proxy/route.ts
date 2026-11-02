import { getRouterForUser, staffHasRestrictedPelangganScope } from "@/lib/authz";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { logger } from "@/lib/logger";
import { validatePPPAdd, parseProxyPayload } from "@/lib/ppp-validate";
import { rateLimit } from "@/lib/ratelimit";
import { resolveMikrotikProxyConnectHost } from "@/lib/router-host-policy";
import { userFacingRouterOsConnectError } from "@/lib/routeros-connect-verify";
import { RouterOSConnectError } from "@/lib/routeros-client";
import {
  routerToCredentials,
  withRouterOsClientPreflight,
} from "@/lib/routeros-session";
import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";

const CONNECTION_ERROR_MSG = "Tidak dapat terhubung ke RouterOS";

function isRouterOsConnectivityError(err: Error & { code?: string }): boolean {
  const code = err.code ?? "";
  return (
    err instanceof RouterOSConnectError ||
    code === "ROUTEROS_UNREACHABLE" ||
    code === "ROUTEROS_PROTOCOL_UNCERTAIN" ||
    code === "ROUTEROS_SSL_REQUIRED" ||
    code === "ROUTEROS_AUTH_FAILED" ||
    code === "ROUTEROS_CONNECT_TIMEOUT" ||
    code === "ROUTEROS_PROTOCOL_MISMATCH" ||
    code === "ROUTEROS_SOCKET_TIMEOUT" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "ECONNRESET"
  );
}

/** Rate limit: per user, 60 request/menit (cukup untuk polling 10s + form + retry). */
const PROXY_RATE_LIMIT_PER_MIN = 60;

export async function POST(request: NextRequest) {
  const { session, user } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });

  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;

  if (await staffHasRestrictedPelangganScope(user)) {
    return NextResponse.json(
      {
        error:
          "Akun staff dengan batas pelanggan PPP tidak dapat menggunakan MikroTik Tools.",
      },
      { status: 403 }
    );
  }

  const rateLimitKey = `mikrotik-proxy:${user.id}`;
  if (rateLimit(rateLimitKey, PROXY_RATE_LIMIT_PER_MIN, 60_000)) {
    logger.warn({ msg: "MikroTik proxy rate limit", userId: user.id });
    return NextResponse.json(
      { error: "Terlalu banyak request. Coba lagi dalam satu menit." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let routerId: string | undefined;
  let command: string | undefined;

  try {
    const body = await request.json();
    routerId = body?.routerId;
    command = body?.command;
    const { data } = body ?? {};

    if (!routerId || !command) {
      return NextResponse.json(
        { error: "Missing routerId or command" },
        { status: 400 }
      );
    }

    if (command === "/ppp/secret/add") {
      if (!Array.isArray(data) || data.length === 0) {
        return NextResponse.json(
          {
            error:
              "Data payload untuk tambah PPP secret wajib berupa array tidak kosong.",
          },
          { status: 400 }
        );
      }
      const parsed = parseProxyPayload(data);
      const validated = validatePPPAdd(parsed);
      if (!validated.success) {
        return NextResponse.json(
          { error: validated.error },
          { status: 400 }
        );
      }
    }

    const ALLOWED_COMMANDS = [
      "/ppp/secret/print",
      "/ppp/profile/print",
      "/ppp/active/print",
      "/ppp/secret/add",
      "/ppp/profile/add",
      "/ppp/secret/set",
      "/ppp/profile/set",
      "/ppp/secret/remove",
      "/ppp/profile/remove",
      "/ppp/secret/enable",
      "/ppp/secret/disable",
      "/ppp/active/remove",
    ];

    if (!ALLOWED_COMMANDS.includes(command)) {
      return NextResponse.json(
        { error: "Command not allowed" },
        { status: 403 }
      );
    }

    // SECURITY: Validate data payload for destructive commands
    const DESTRUCTIVE_COMMANDS = [
      "/ppp/secret/set",
      "/ppp/secret/remove",
      "/ppp/secret/disable",
      "/ppp/active/remove",
      "/ppp/profile/set",
      "/ppp/profile/remove",
    ];

    if (DESTRUCTIVE_COMMANDS.includes(command)) {
      if (Array.isArray(data)) {
        // SECURITY: Require explicit .id for remove operations
        if (command.includes("/remove")) {
          const idParam = data.find(
            (p) => typeof p === "string" && p.startsWith("=.id=")
          );
          
          if (!idParam) {
            return NextResponse.json(
              { error: "Remove operations require explicit .id parameter" },
              { status: 400 }
            );
          }
          
          // Extract ID value after "=.id="
          const idValue = idParam.substring(5).trim();
          
          // Block: empty, undefined, null, or lone wildcard "*"
          // Allow: RouterOS IDs like *1A, *3F (specific identifiers)
          if (!idValue || idValue === "*") {
            return NextResponse.json(
              { error: "Wildcard operations are not allowed for safety" },
              { status: 400 }
            );
          }
        }
        
        // SECURITY: For set operations, validate .id if present
        if (command.includes("/set")) {
          const idParam = data.find(
            (p) => typeof p === "string" && p.startsWith("=.id=")
          );
          
          if (idParam) {
            const idValue = idParam.substring(5).trim();
            
            // Block: empty, undefined, null, or lone wildcard "*"
            if (!idValue || idValue === "*") {
              return NextResponse.json(
                { error: "Wildcard operations are not allowed for safety" },
                { status: 400 }
              );
            }
          }
        }
      }
    }

    const cmd: string = command;

    const router = await getRouterForUser(parseInt(routerId, 10), user);
    if (!router) {
      return NextResponse.json(
        { error: "Router tidak ditemukan atau akses ditolak" },
        { status: 403 }
      );
    }

    let connectHost: string;
    try {
      connectHost = await resolveMikrotikProxyConnectHost(router.host);
    } catch (policyErr) {
      const msg =
        policyErr instanceof Error ? policyErr.message : "Host router ditolak";
      logger.warn({
        msg: "MikroTik proxy: host policy rejected",
        routerId,
        host: router.host,
        error: msg,
      });
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const proxyLabel = `mikrotik-proxy:${routerId}:${cmd}`;

    let result: unknown;
    try {
      result = await withRouterOsClientPreflight(
        routerToCredentials({
          host: connectHost,
          port: router.port,
          user: router.user,
          password: router.password,
        }),
        proxyLabel,
        async (api) => {
          const identityCheck = await api.write("/system/identity/print");
          const isValidRouterOS =
            Array.isArray(identityCheck) &&
            identityCheck.length > 0 &&
            typeof identityCheck[0] === "object" &&
            identityCheck[0] !== null;
          if (!isValidRouterOS) {
            logger.warn({
              msg: "MikroTik proxy: response not from RouterOS (identity check)",
              routerId,
              host: router.host,
              command: cmd,
            });
            throw new Error(CONNECTION_ERROR_MSG);
          }

          if (data !== undefined && data !== null) {
            return api.write(cmd, data);
          }
          return api.write(cmd);
        }
      );
    } catch (err) {
      const error = err as Error & { code?: string; errno?: number };
      const message = isRouterOsConnectivityError(error)
        ? userFacingRouterOsConnectError(error)
        : error.message || CONNECTION_ERROR_MSG;

      logger.error({
        msg: "MikroTik proxy: router unreachable or command error",
        routerId,
        host: router.host,
        port: router.port,
        command: cmd,
        label: proxyLabel,
        error: error.message,
        code: error.code,
      });

      return NextResponse.json({ error: message }, { status: 503 });
    }

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    logger.error({
      msg: "MikroTik proxy: unexpected error",
      routerId: routerId ?? "unknown",
      command: command ?? "unknown",
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
