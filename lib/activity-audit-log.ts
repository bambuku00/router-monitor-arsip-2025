import { logSecurityEvent, type SecurityAuditEvent } from "@/lib/security-audit-log";

export type ActivityAuditEvent = Omit<SecurityAuditEvent, "outcome"> & {
  outcome?: SecurityAuditEvent["outcome"];
};

/** Activity / operasional log — dipersist ke tabel audit_logs (Activity Log). */
export function logActivityEvent(event: ActivityAuditEvent): void {
  logSecurityEvent({
    ...event,
    outcome: event.outcome ?? "success",
  });
}
