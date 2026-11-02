import { pickRestoreProfile } from "@/lib/ppp-isolir-service";
import { orderPools, type PppBackupPool, type PppBackupProfile } from "@/lib/ppp-profile-backup";

export type { PppBackupPool, PppBackupProfile };

export type PppBackupSecret = {
  name: string;
  password: string;
  service: string;
  profile: string;
  comment: string | null;
  disabled: string;
  isIsolir: boolean;
  profileBeforeIsolir: string | null;
  pelangganNama: string | null;
  paketNama: string | null;
};

function routerosQuoted(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, " ")}"`;
}

function isDisabled(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "yes";
}

function restoreProfile(secret: PppBackupSecret): string {
  if (!secret.isIsolir) return secret.profile.trim();
  return (
    pickRestoreProfile({
      profileBeforeIsolir: secret.profileBeforeIsolir,
      paketNama: secret.paketNama,
      isolirProfileName: secret.profile,
    }) ?? secret.profile.trim()
  );
}

function profileAddLine(profile: PppBackupProfile): string {
  const parts = ["add", `name=${routerosQuoted(profile.name)}`];
  const fields: [string, string | null][] = [
    ["rate-limit", profile.rateLimit],
    ["local-address", profile.localAddress],
    ["remote-address", profile.remoteAddress],
    ["only-one", profile.onlyOne],
    ["dns-server", profile.dnsServer],
    ["address-list", profile.addressList],
    ["parent-queue", profile.parentQueue],
    ["queue-type", profile.queueType],
    ["bridge", profile.bridge],
    ["session-timeout", profile.sessionTimeout],
    ["idle-timeout", profile.idleTimeout],
    ["change-tcp-mss", profile.changeTcpMss],
    ["comment", profile.comment],
  ];
  for (const [key, value] of fields) {
    if (value) parts.push(`${key}=${routerosQuoted(value)}`);
  }
  return parts.join(" ");
}

function poolAddLine(pool: PppBackupPool): string {
  const parts = [
    "add",
    `name=${routerosQuoted(pool.name)}`,
    `ranges=${routerosQuoted(pool.ranges)}`,
  ];
  if (pool.nextPool) parts.push(`next-pool=${routerosQuoted(pool.nextPool)}`);
  if (pool.comment) parts.push(`comment=${routerosQuoted(pool.comment)}`);
  return parts.join(" ");
}

/** Skrip RouterOS: IP pool, lalu profil, lalu secret. */
export function buildPppBackupScript(params: {
  routerName: string;
  exportedAt: string;
  secrets: PppBackupSecret[];
  profiles?: PppBackupProfile[];
  pools?: PppBackupPool[];
  profileNote?: string;
}): string {
  const profiles = [...(params.profiles ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, "id")
  );
  const pools = orderPools(params.pools ?? []);
  const lines = [
    "# Cadangan PPPoE dari billing: IP pool, profil, lalu secret",
    `# Router: ${params.routerName.replace(/[\r\n]/g, " ")}`,
    `# Waktu: ${params.exportedAt}`,
    `# IP pool: ${pools.length}${params.profileNote ? ` (${params.profileNote})` : ""}`,
    `# Profil: ${profiles.length}`,
    `# Secret: ${params.secrets.length}`,
    "# Profil yang sedang isolir pada secret dikembalikan ke profil sebelum isolir.",
    "# Simpan berkas ini. Di Mikrotik baru: unggah lewat Files, lalu jalankan",
    "# /import file-name=nama-berkas.rsc",
    "",
    "/ip pool",
  ];

  if (pools.length === 0) {
    lines.push(
      "# Belum ada cuplikan IP pool. Sinkron PPPoE sekali selagi router hidup, lalu export lagi."
    );
  } else {
    for (const pool of pools) {
      lines.push(poolAddLine(pool));
    }
  }

  lines.push("", "/ppp profile");

  if (profiles.length === 0) {
    lines.push(
      "# Belum ada cuplikan profil. Sinkron PPPoE sekali selagi router hidup, lalu export lagi."
    );
  } else {
    for (const profile of profiles) {
      if (!profile.name.trim()) continue;
      lines.push(profileAddLine(profile));
    }
  }

  lines.push("", "/ppp secret");

  const sorted = [...params.secrets].sort((a, b) =>
    a.name.localeCompare(b.name, "id")
  );

  for (const secret of sorted) {
    const name = secret.name.trim();
    if (!name) continue;
    const profile = restoreProfile(secret);
    const comment = (secret.comment?.trim() || secret.pelangganNama?.trim() || "").trim();
    const parts = [
      "add",
      `name=${routerosQuoted(name)}`,
      `password=${routerosQuoted(secret.password ?? "")}`,
      `service=${routerosQuoted(secret.service || "pppoe")}`,
    ];
    if (profile) parts.push(`profile=${routerosQuoted(profile)}`);
    if (comment) parts.push(`comment=${routerosQuoted(comment)}`);
    parts.push(`disabled=${!secret.isIsolir && isDisabled(secret.disabled) ? "yes" : "no"}`);
    lines.push(parts.join(" "));
  }

  if (params.secrets.length === 0) {
    lines.push("# Tidak ada secret tersimpan. Sinkron PPPoE dulu jika router masih bisa dihubungi.");
  }

  lines.push("");
  return lines.join("\n");
}

export function pppBackupFilename(routerName: string, date: string): string {
  const slug = routerName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `pppoe-cadangan-${slug || "router"}-${date}.rsc`;
}
