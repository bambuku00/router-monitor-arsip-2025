import { formatIsolirLogActor } from "@/lib/isolir-actor-label";

const ACTION_LABELS: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  register: "Registrasi",
  free_customer_limit_changed: "Kuota pelanggan gratis",
  ppp_auto_fill_daily: "Auto isi PPPoE",
  ppp_sync_berhenti_reconcile: "Penyesuaian berhenti",
  ppp_package_changed: "Ganti paket",
  pelanggan_baru: "Pelanggan baru",
};

const OUTCOME_LABELS: Record<string, string> = {
  success: "Berhasil",
  failed: "Gagal",
  denied: "Ditolak",
  rate_limited: "Dibatasi",
};

export const AUDIT_LOG_ACTIONS = Object.keys(ACTION_LABELS);

export const ACTIVITY_LOG_FILTERS = [
  ...AUDIT_LOG_ACTIONS.map((value) => ({
    value,
    label: ACTION_LABELS[value],
  })),
  { value: "isolir", label: "Isolir" },
  { value: "buka_isolir", label: "Buka isolir" },
  { value: "pembayaran", label: "Pembayaran" },
  { value: "pembatalan", label: "Pembatalan" },
  { value: "berhenti", label: "Berhenti" },
  { value: "lanjut", label: "Lanjut berlangganan" },
] as const;

export type ActivityLogFilter = (typeof ACTIVITY_LOG_FILTERS)[number]["value"];

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function auditOutcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? outcome;
}

export function auditLogKeterangan(row: {
  action: string;
  reason: string | null;
  meta: unknown;
}): string {
  if (row.action === "ppp_auto_fill_daily") {
    const meta = isRecord(row.meta) ? row.meta : null;
    const routerId = meta?.routerId;
    const created = meta?.created;
    const linked = meta?.linked;
    const parts = [
      routerId != null ? `Router ${routerId}` : null,
      created != null ? `dibuat ${created}` : null,
      linked != null ? `ditautkan ${linked}` : null,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
  }
  const reason = row.reason?.trim();
  if (!reason || reason.startsWith("router:")) return "—";
  return reason;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export type ActivityLogView = {
  id: string;
  created: string;
  action: string;
  actionLabel: string;
  outcome: string;
  outcomeLabel: string;
  pelaku: string;
  ip: string;
  keterangan: string;
};

export function mapIsolirActivity(row: {
  id: number;
  created: Date;
  action: "isolate" | "restore";
  status: "success" | "failed" | "skipped";
  executedBy: string;
  dryRun: boolean;
  pppUsername: string | null;
  oldProfile: string | null;
  newProfile: string | null;
  errorMessage: string | null;
  pelangganNama: string | null;
  dueDate: string | null;
}): ActivityLogView {
  const dryRun = row.dryRun || row.executedBy.trim() === "dry-run";
  const parts = [
    row.pelangganNama?.trim(),
    row.pppUsername?.trim(),
    row.dueDate?.trim() ? `jatuh tempo ${row.dueDate.trim()}` : null,
    row.oldProfile?.trim() && row.newProfile?.trim()
      ? `${row.oldProfile.trim()} → ${row.newProfile.trim()}`
      : null,
    row.status === "failed" ? row.errorMessage?.trim() : null,
  ].filter((part): part is string => Boolean(part));

  return {
    id: `isolir:${row.id}`,
    created: row.created.toISOString(),
    action: row.action === "restore" ? "buka_isolir" : "isolir",
    actionLabel: row.action === "restore" ? "Buka isolir" : "Isolir",
    outcome: dryRun ? "dry_run" : row.status,
    outcomeLabel: dryRun
      ? "Uji coba"
      : row.status === "failed"
        ? "Gagal"
        : row.status === "skipped"
          ? "Dilewati"
          : "Berhasil",
    pelaku: formatIsolirLogActor(row.executedBy, row.dryRun),
    ip: "—",
    keterangan: parts.length > 0 ? parts.join(" · ") : "—",
  };
}

export function mapPaymentActivity(row: {
  id: number;
  created: Date;
  status: "Terbayar" | "Belum";
  total: number;
  metode: string | null;
  noInvoice: string | null;
  pelangganNama: string | null;
  jatuhTempo: string | null;
  pelaku: string;
}): ActivityLogView {
  const cancel = row.status === "Belum";
  const parts = [
    row.pelangganNama?.trim(),
    row.noInvoice?.trim() ? `INV ${row.noInvoice.trim()}` : null,
    row.jatuhTempo?.trim() ? `jatuh tempo ${row.jatuhTempo.trim()}` : null,
    `Rp ${Math.round(row.total).toLocaleString("id-ID")}`,
    row.metode?.trim() || null,
  ].filter((part): part is string => Boolean(part));

  return {
    id: `bayar:${row.id}`,
    created: row.created.toISOString(),
    action: cancel ? "pembatalan" : "pembayaran",
    actionLabel: cancel ? "Pembatalan" : "Pembayaran",
    outcome: "success",
    outcomeLabel: "Berhasil",
    pelaku: row.pelaku.trim() || "—",
    ip: "—",
    keterangan: parts.join(" · "),
  };
}

export function mapSubscriptionActivity(row: {
  id: number;
  created: Date;
  action: "stop" | "resume";
  executedBy: string;
  pelangganNama: string | null;
  pppUsername: string | null;
}): ActivityLogView {
  const stop = row.action === "stop";
  const parts = [row.pelangganNama?.trim(), row.pppUsername?.trim()].filter(
    (part): part is string => Boolean(part)
  );

  return {
    id: `langganan:${row.id}`,
    created: row.created.toISOString(),
    action: stop ? "berhenti" : "lanjut",
    actionLabel: stop ? "Berhenti" : "Lanjut berlangganan",
    outcome: "success",
    outcomeLabel: "Berhasil",
    pelaku: formatIsolirLogActor(row.executedBy),
    ip: "—",
    keterangan: parts.length > 0 ? parts.join(" · ") : "—",
  };
}

export function mergeActivityWindow<T extends { created: Date; id: string }>(
  groups: T[][],
  page: number,
  limit: number
): T[] {
  const merged = groups.flat().sort((a, b) => {
    const time = b.created.getTime() - a.created.getTime();
    if (time !== 0) return time;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
  const start = (page - 1) * limit;
  return merged.slice(start, start + limit);
}
