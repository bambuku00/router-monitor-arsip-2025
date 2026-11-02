/**
 * Merge PPP Secret + PPP Active rows for Tools → MikroTik table.
 * Active session IP (pool) lives on /ppp/active/print → address, not on secret remote-address.
 */

export type MikrotikSecretRow = {
  ".id": string;
  name: string;
  password?: string;
  profile: string;
  service: string;
  comment?: string;
  "local-address"?: string;
  "remote-address"?: string;
  disabled?: string;
  ipPppoe: string;
  isOnline: boolean;
  statusLabel: "Online" | "Offline" | "Disabled";
};

/** Parse proxy JSON body: `{ data: [...] }` or bare array. */
export function parseProxyList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data: unknown }).data;
    return Array.isArray(data) ? data : [];
  }
  return [];
}

/** Flatten RouterOS print record (top-level keys + optional nested attrs). */
export function flattenRouterOsRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === "attrs" && value && typeof value === "object") {
      for (const [attrKey, attrVal] of Object.entries(
        value as Record<string, unknown>
      )) {
        if (typeof attrVal === "string") out[attrKey] = attrVal;
      }
      continue;
    }
    if (typeof value === "string") out[key] = value;
  }

  return out;
}

export function resolveIpPppoe(
  activeEntry: { address: string } | undefined,
  remoteAddress: string | undefined
): string {
  const fromActive = activeEntry?.address?.trim();
  if (fromActive) return fromActive;

  const remote = remoteAddress?.trim();
  if (remote && remote !== "-") return remote;

  return "-";
}

/** Map username → active session (by String(name), not array index). */
export function buildActiveByName(
  activeList: unknown[]
): Map<string, { address: string }> {
  const map = new Map<string, { address: string }>();

  for (const item of activeList) {
    const flat = flattenRouterOsRecord(item);
    const name = flat.name;
    if (!name) continue;

    const key = String(name);
    map.set(key, { address: flat.address?.trim() ?? "" });
  }

  return map;
}

export function mergeSecretWithActive(
  secretRaw: unknown,
  activeByName: Map<string, { address: string }>
): MikrotikSecretRow {
  const flat = flattenRouterOsRecord(secretRaw);
  const name = String(flat.name ?? "");
  const disabled = String(flat.disabled) === "true";
  const activeEntry = activeByName.get(name);
  const isOnline = activeEntry !== undefined && !disabled;

  const statusLabel: MikrotikSecretRow["statusLabel"] = disabled
    ? "Disabled"
    : isOnline
      ? "Online"
      : "Offline";

  return {
    ".id": flat[".id"] ?? "",
    name,
    password: flat.password,
    profile: flat.profile ?? "",
    service: flat.service ?? "",
    comment: flat.comment,
    "local-address": flat["local-address"],
    "remote-address": flat["remote-address"],
    disabled: flat.disabled,
    ipPppoe: resolveIpPppoe(activeEntry, flat["remote-address"]),
    isOnline,
    statusLabel,
  };
}

export function mergeSecretRows(
  secrets: unknown[],
  activeList: unknown[]
): MikrotikSecretRow[] {
  const activeByName = buildActiveByName(activeList);
  return secrets.map((secret) => mergeSecretWithActive(secret, activeByName));
}
