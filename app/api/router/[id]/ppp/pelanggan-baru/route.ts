import { validateRequest } from "@/lib/auth";
import {
  assertScopedStaffMayUseRouterLevelPpp,
  getRouterForUser,
} from "@/lib/authz";
import { logActivityEvent } from "@/lib/activity-audit-log";
import { formatIsolirActor } from "@/lib/isolir-actor-label";
import { createPelangganLinkedToPpp } from "@/lib/pelanggan-ppp-create";
import { logger } from "@/lib/logger";
import { validatePPPAdd } from "@/lib/ppp-validate";
import prisma from "@/lib/prisma";
import { errorApiResponse } from "@/lib/server-actions/api";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import {
  routerToCredentialsWithHostPolicy,
  withRouterOsClient,
} from "@/lib/routeros-session";
import { NextRequest, NextResponse } from "next/server";

/** Add secret + print di VPS → Mikrotik butuh lebih dari timeout koneksi 5 detik. */
export const maxDuration = 60;
const PELANGGAN_BARU_ROUTEROS_TIMEOUT_MS = 45_000;

type RosSecretRow = {
  ".id"?: string;
  name?: string;
  password?: string;
  profile?: string;
  service?: string;
  disabled?: string;
  comment?: string;
  "caller-id"?: string;
  routes?: string;
  "ipv6-routes"?: string;
  "limit-bytes-in"?: string;
  "limit-bytes-out"?: string;
  "last-logged-out"?: string;
  "last-caller-id"?: string;
  "last-disconnect-reason"?: string;
};

function withoutSecret(message: string, password: string) {
  if (!password) return message;
  return message.split(password).join("***");
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });

  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;

  const scoped = await assertScopedStaffMayUseRouterLevelPpp(user);
  if (!scoped.ok) {
    return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  }

  const params = await segmentData.params;
  const routerId = parseInt(params.id, 10);
  if (Number.isNaN(routerId)) {
    return NextResponse.json({ message: "Router tidak valid" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ message: "Data tidak valid" }, { status: 400 });
    }
    body = raw as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Data tidak valid" }, { status: 400 });
  }

  const secretName = typeof body.secret === "string" ? body.secret.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const profile = typeof body.profile === "string" ? body.profile.trim() : "";
  const nama = typeof body.nama === "string" ? body.nama.trim() : "";

  const validated = validatePPPAdd({
    name: secretName,
    password,
    profile,
    service: "pppoe",
    comment: nama,
  });
  if (!validated.success) {
    return NextResponse.json({ message: validated.error }, { status: 400 });
  }

  try {
    const router = await getRouterForUser(routerId, user);
    if (!router) {
      return NextResponse.json(
        { message: "Router tidak ditemukan atau akses ditolak" },
        { status: 403 }
      );
    }

    const local = await prisma.pppSecret.findUnique({
      where: { routerId_name: { routerId, name: secretName } },
      select: { id: true },
    });
    if (local) {
      return NextResponse.json(
        { message: "Secret ini sudah ada di router ini" },
        { status: 409 }
      );
    }

    let pelangganId = 0;
    let message = "Berhasil menambah pelanggan dan secret di Mikrotik";
    const creds = await routerToCredentialsWithHostPolicy(router);

    try {
      // Hanya perintah Mikrotik di sesi RouterOS. Simpan DB di luar
      // supaya tidak ikut watchdog 5 detik (penyebab NetworkError).
      const row = await withRouterOsClient(
        creds,
        `ppp-pelanggan-baru:${router.id}:${secretName}`,
        async (api) => {
          const existing = (await api.write([
            "/ppp/secret/print",
            `?name=${secretName}`,
          ])) as RosSecretRow[];
          if (existing.length > 0) {
            throw new Error("USER_EXISTS");
          }

          const addResult = (await api.write([
            "/ppp/secret/add",
            `=name=${secretName}`,
            `=password=${password}`,
            "=service=pppoe",
            `=profile=${profile}`,
            `=comment=${nama}`,
          ])) as Array<RosSecretRow & { ret?: string }>;
          const addedId = String(
            addResult?.[0]?.ret ?? addResult?.[0]?.[".id"] ?? ""
          ).trim();

          let row: RosSecretRow | undefined;
          if (addedId) {
            const byId = (await api.write([
              "/ppp/secret/print",
              `?.id=${addedId}`,
            ])) as RosSecretRow[];
            row = byId[0];
          }
          if (!row) {
            const byName = (await api.write([
              "/ppp/secret/print",
              `?name=${secretName}`,
            ])) as RosSecretRow[];
            row = byName[0];
          }
          // Beberapa RouterOS/proxy mengembalikan add sukses tapi print filter kosong.
          // Lanjut dengan data yang baru di-submit agar pelanggan tetap tersimpan.
          if (!row) {
            logger.warn({
              msg: "PPP secret add ok tapi print kosong; pakai data request",
              routerId,
              secretName,
              addedId: addedId || null,
            });
            row = {
              ".id": addedId || undefined,
              name: secretName,
              password,
              profile,
              service: "pppoe",
              disabled: "false",
              comment: nama,
            };
          }
          if (!row[".id"] && !row.name) {
            throw new Error("SECRET_MISSING");
          }
          return row;
        },
        PELANGGAN_BARU_ROUTEROS_TIMEOUT_MS
      );

      const created = await prisma.pppSecret.create({
            data: {
              secretId: String(row[".id"] ?? ""),
              routerId,
              name: secretName,
              service: "pppoe",
              callerId: String(row["caller-id"] ?? ""),
              password,
              profile: String(row.profile ?? profile),
              routes: String(row.routes ?? ""),
              ipv6_routes: String(row["ipv6-routes"] ?? ""),
              limit_bytes_in: String(row["limit-bytes-in"] ?? ""),
              limit_bytes_out: String(row["limit-bytes-out"] ?? ""),
              last_logged_out: String(row["last-logged-out"] ?? ""),
              last_callerId: row["last-caller-id"]
                ? String(row["last-caller-id"])
                : null,
              last_disconnect_reason: row["last-disconnect-reason"]
                ? String(row["last-disconnect-reason"])
                : null,
              disabled: String(row.disabled ?? "false"),
              comment: nama || null,
              on_router: true,
            },
            select: { id: true },
          });

          try {
            const saved = await createPelangganLinkedToPpp(user, {
              ...body,
              routerId,
              ppp_secretId: created.id,
            });
            if (!saved.ok) {
              throw Object.assign(
                new Error(
                  saved.body.message ?? saved.body.error ?? "Gagal menyimpan pelanggan"
                ),
                { status: saved.status, body: saved.body }
              );
            }
            pelangganId = saved.pelangganId;
            message = "Berhasil menambah pelanggan dan secret di Mikrotik";
      } catch (err) {
        await prisma.pppSecret
          .delete({ where: { id: created.id } })
          .catch(() => undefined);
        if (row[".id"]) {
          await withRouterOsClient(
            creds,
            `ppp-pelanggan-baru-rollback:${router.id}:${secretName}`,
            async (api) => {
              await api.write(["/ppp/secret/remove", `=.id=${row[".id"]}`]);
            },
            PELANGGAN_BARU_ROUTEROS_TIMEOUT_MS
          ).catch(() => undefined);
        }
        throw err;
      }
    } catch (apiError) {
      const error = apiError as Error & {
        status?: number;
        body?: { message?: string; error?: string };
      };
      if (error.message === "USER_EXISTS") {
        return NextResponse.json(
          { message: "Secret ini sudah ada di Mikrotik" },
          { status: 409 }
        );
      }
      if (error.message === "SECRET_MISSING") {
        return NextResponse.json(
          {
            message:
              "Secret sudah dikirim ke Mikrotik tetapi tidak bisa dibaca ulang. Cek secret di Mikrotik, lalu sync PPPoE.",
          },
          { status: 502 }
        );
      }
      if (error.status && error.body) {
        return NextResponse.json(error.body, { status: error.status });
      }
      logger.error({
        msg: "Gagal tambah pelanggan PPPoE",
        error: withoutSecret(error.message, password),
      });
      return NextResponse.json(
        {
          message: withoutSecret(
            error.message || "Gagal menambah secret di Mikrotik",
            password
          ),
        },
        { status: 500 }
      );
    }

    if (pelangganId > 0) {
      const paketId =
        typeof body.paketId === "number" ? body.paketId : Number(body.paketId);
      const paket =
        Number.isInteger(paketId) && paketId > 0
          ? await prisma.paket.findUnique({
              where: { id: paketId },
              select: { nama: true },
            })
          : null;
      logActivityEvent({
        action: "pelanggan_baru",
        userId: router.userId ?? user.id,
        username: formatIsolirActor(user),
        reason: [nama, secretName, paket?.nama?.trim() || profile]
          .filter(Boolean)
          .join(" · "),
        meta: {
          routerId,
          pelangganId,
          secretName,
          actorUserId: user.id,
        },
      });
    }

    return NextResponse.json({
      data: { id: pelangganId },
      message,
    });
  } catch (err) {
    return errorApiResponse(err);
  }
}
