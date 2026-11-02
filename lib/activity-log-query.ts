import { formatIsolirActor } from "@/lib/isolir-actor-label";
import { resolveIsolirExecutedBy } from "@/lib/manual-isolir-log";
import prisma from "@/lib/prisma";
import {
  AUDIT_LOG_ACTIONS,
  auditActionLabel,
  auditLogKeterangan,
  auditOutcomeLabel,
  mapIsolirActivity,
  mapPaymentActivity,
  mapSubscriptionActivity,
  mergeActivityWindow,
  type ActivityLogFilter,
  type ActivityLogView,
} from "@/lib/audit-log-label";
import type { Prisma } from "@prisma/client";

type Scope = {
  mitraId: number | null;
  userIds: number[];
  usernames: string[];
};

function createdRange(from: string, to: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  };
}

function wantsAudit(action: string): boolean {
  return !action || AUDIT_LOG_ACTIONS.includes(action);
}

function wantsIsolir(action: string): boolean {
  return !action || action === "isolir" || action === "buka_isolir";
}

function wantsPayment(action: string): boolean {
  return !action || action === "pembayaran" || action === "pembatalan";
}

function wantsSubscription(action: string): boolean {
  return !action || action === "berhenti" || action === "lanjut";
}

export async function listActivityLogs(params: {
  scope: Scope;
  page: number;
  limit: number;
  action: string;
  from: string;
  to: string;
}): Promise<{ data: ActivityLogView[]; total: number }> {
  const created = createdRange(params.from, params.to);
  const window = params.page * params.limit;
  const singleSource =
    Boolean(params.action) &&
    [
      wantsAudit(params.action),
      wantsIsolir(params.action),
      wantsPayment(params.action),
      wantsSubscription(params.action),
    ].filter(Boolean).length === 1;
  const take = singleSource ? params.limit : window;
  const skip = singleSource ? (params.page - 1) * params.limit : 0;

  const [
    auditTotal,
    isolirTotal,
    paymentTotal,
    auditRows,
    isolirRows,
    paymentRows,
    subscriptionTotal,
    subscriptionRows,
  ] = await Promise.all([
      wantsAudit(params.action)
        ? prisma.auditLog.count({ where: auditWhere(params.scope, params.action, created) })
        : Promise.resolve(0),
      wantsIsolir(params.action)
        ? prisma.autoIsolirLog.count({
            where: isolirWhere(params.scope, params.action, created),
          })
        : Promise.resolve(0),
      wantsPayment(params.action)
        ? prisma.logBayar.count({ where: paymentWhere(params.scope, params.action, created) })
        : Promise.resolve(0),
      wantsAudit(params.action)
        ? prisma.auditLog.findMany({
            where: auditWhere(params.scope, params.action, created),
            orderBy: { created: "desc" },
            skip,
            take,
            select: {
              id: true,
              created: true,
              action: true,
              outcome: true,
              username: true,
              ip: true,
              reason: true,
              meta: true,
            },
          })
        : Promise.resolve([]),
      wantsIsolir(params.action)
        ? prisma.autoIsolirLog.findMany({
            where: isolirWhere(params.scope, params.action, created),
            orderBy: { created: "desc" },
            skip,
            take,
            select: {
              id: true,
              created: true,
              action: true,
              status: true,
              executedBy: true,
              dryRun: true,
              pppUsername: true,
              oldProfile: true,
              newProfile: true,
              errorMessage: true,
              dueDate: true,
              pelanggan: { select: { nama: true } },
            },
          })
        : Promise.resolve([]),
      wantsPayment(params.action)
        ? prisma.logBayar.findMany({
            where: paymentWhere(params.scope, params.action, created),
            orderBy: { created: "desc" },
            skip,
            take,
            select: {
              id: true,
              created: true,
              status: true,
              total: true,
              metode: true,
              user: { select: { nama: true, user: true } },
              pembayaran: {
                select: {
                  noInvoice: true,
                  jatuh_tempo: true,
                  pelanggan: { select: { nama: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      wantsSubscription(params.action)
        ? prisma.pelangganStatusLog.count({
            where: subscriptionWhere(params.scope, params.action, created),
          })
        : Promise.resolve(0),
      wantsSubscription(params.action)
        ? prisma.pelangganStatusLog.findMany({
            where: subscriptionWhere(params.scope, params.action, created),
            orderBy: { created: "desc" },
            skip,
            take,
            select: {
              id: true,
              created: true,
              action: true,
              executedBy: true,
              pelanggan: {
                select: {
                  nama: true,
                  ppp_secret: { select: { name: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

  const readableIsolir = await resolveIsolirExecutedBy(isolirRows);
  const auditViews = auditRows.map((row) => ({
    created: row.created,
    id: `audit:${row.id.toString()}`,
    view: {
      id: `audit:${row.id.toString()}`,
      created: row.created.toISOString(),
      action: row.action,
      actionLabel: auditActionLabel(row.action),
      outcome: row.outcome,
      outcomeLabel: auditOutcomeLabel(row.outcome),
      pelaku: row.username?.trim() || "—",
      ip: row.ip?.trim() || "—",
      keterangan: auditLogKeterangan(row),
    } satisfies ActivityLogView,
  }));
  const isolirViews = readableIsolir.map((row) => {
    const view = mapIsolirActivity({
      id: row.id,
      created: row.created,
      action: row.action,
      status: row.status,
      executedBy: row.executedBy,
      dryRun: row.dryRun,
      pppUsername: row.pppUsername,
      oldProfile: row.oldProfile,
      newProfile: row.newProfile,
      errorMessage: row.errorMessage,
      pelangganNama: row.pelanggan?.nama ?? null,
      dueDate: row.dueDate,
    });
    return { created: row.created, id: view.id, view };
  });
  const paymentViews = paymentRows.map((row) => {
    const view = mapPaymentActivity({
      id: row.id,
      created: row.created,
      status: row.status,
      total: row.total,
      metode: row.metode,
      noInvoice: row.pembayaran.noInvoice,
      pelangganNama: row.pembayaran.pelanggan.nama,
      jatuhTempo: row.pembayaran.jatuh_tempo,
      pelaku: formatIsolirActor(row.user),
    });
    return { created: row.created, id: view.id, view };
  });
  const readableSubscription = await resolveIsolirExecutedBy(subscriptionRows);
  const subscriptionViews = readableSubscription.map((row) => {
    const view = mapSubscriptionActivity({
      id: row.id,
      created: row.created,
      action: row.action,
      executedBy: row.executedBy,
      pelangganNama: row.pelanggan.nama,
      pppUsername: row.pelanggan.ppp_secret?.name ?? null,
    });
    return { created: row.created, id: view.id, view };
  });

  const pageRows = singleSource
    ? [...auditViews, ...isolirViews, ...paymentViews, ...subscriptionViews]
    : mergeActivityWindow(
        [auditViews, isolirViews, paymentViews, subscriptionViews],
        params.page,
        params.limit
      );

  return {
    data: pageRows.map((row) => row.view),
    total: auditTotal + isolirTotal + paymentTotal + subscriptionTotal,
  };
}

function auditWhere(
  scope: Scope,
  action: string,
  created: Prisma.DateTimeFilter | undefined
): Prisma.AuditLogWhereInput {
  return {
    ...(action && AUDIT_LOG_ACTIONS.includes(action) ? { action } : {}),
    ...(created ? { created } : {}),
    ...(scope.mitraId == null
      ? {}
      : {
          OR: [
            { userId: { in: scope.userIds } },
            { username: { in: scope.usernames } },
          ],
        }),
  };
}

function isolirWhere(
  scope: Scope,
  action: string,
  created: Prisma.DateTimeFilter | undefined
): Prisma.AutoIsolirLogWhereInput {
  return {
    ...(scope.mitraId == null ? {} : { userId: scope.mitraId }),
    ...(action === "isolir"
      ? { action: "isolate" }
      : action === "buka_isolir"
        ? { action: "restore" }
        : {}),
    ...(created ? { created } : {}),
  };
}

function paymentWhere(
  scope: Scope,
  action: string,
  created: Prisma.DateTimeFilter | undefined
): Prisma.LogBayarWhereInput {
  return {
    ...(action === "pembayaran"
      ? { status: "Terbayar" }
      : action === "pembatalan"
        ? { status: "Belum" }
        : {}),
    ...(created ? { created } : {}),
    ...(scope.mitraId == null
      ? {}
      : { pembayaran: { pelanggan: { router: { userId: scope.mitraId } } } }),
  };
}

function subscriptionWhere(
  scope: Scope,
  action: string,
  created: Prisma.DateTimeFilter | undefined
): Prisma.PelangganStatusLogWhereInput {
  return {
    ...(action === "berhenti"
      ? { action: "stop" }
      : action === "lanjut"
        ? { action: "resume" }
        : {}),
    ...(created ? { created } : {}),
    ...(scope.mitraId == null
      ? {}
      : { pelanggan: { router: { userId: scope.mitraId } } }),
  };
}

export function isActivityFilter(value: string): value is ActivityLogFilter {
  return (
    AUDIT_LOG_ACTIONS.includes(value) ||
    value === "isolir" ||
    value === "buka_isolir" ||
    value === "pembayaran" ||
    value === "pembatalan" ||
    value === "berhenti" ||
    value === "lanjut"
  );
}
