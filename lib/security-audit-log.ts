import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

export type SecurityAuditEvent = {
  action: string;
  outcome: "denied" | "failed" | "rate_limited" | "success";
  ip?: string;
  userAgent?: string | null;
  endpoint?: string;
  username?: string;
  userId?: number;
  reason?: string;
  meta?: Record<string, unknown>;
};

/**
 * Structured security events (failed auth, forbidden, rate limit, pembayaran, isolir).
 * Ditulis ke structured log (pino) untuk real-time DAN dipersist ke tabel `audit_logs`
 * agar dapat di-query/di-export (Guardian / audit trail). Jangan sertakan secret.
 */
export function logSecurityEvent(event: SecurityAuditEvent) {
  logger.warn({
    msg: "security_audit",
    action: event.action,
    outcome: event.outcome,
    ip: event.ip ?? "unknown",
    userAgent: event.userAgent?.slice(0, 200) ?? undefined,
    endpoint: event.endpoint,
    username: event.username,
    userId: event.userId,
    reason: event.reason,
    ...event.meta,
  });

  // Persist ke DB best-effort — jangan blokir alur request; jangan lempar error
  // (mis. saat tabel belum termigrasi). Log kegagalan di-throttle agar tidak spam.
  void persistAuditLog(event);
}

async function persistAuditLog(event: SecurityAuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: event.action,
        outcome: event.outcome,
        userId: event.userId ?? null,
        username: event.username ?? null,
        ip: event.ip ?? null,
        userAgent: event.userAgent?.slice(0, 1000) ?? null,
        endpoint: event.endpoint ?? null,
        reason: event.reason ?? null,
        meta:
          event.meta && Object.keys(event.meta).length > 0
            ? (event.meta as object)
            : undefined,
      },
    });
  } catch (err) {
    const now = Date.now();
    const g = globalThis as { __auditLogDbErrLog?: number };
    if (now - (g.__auditLogDbErrLog ?? 0) > 90_000) {
      g.__auditLogDbErrLog = now;
      logger.error({
        msg: "persistAuditLog: gagal simpan audit ke DB (throttle 90s). Pastikan migrasi audit_logs sudah dijalankan.",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
