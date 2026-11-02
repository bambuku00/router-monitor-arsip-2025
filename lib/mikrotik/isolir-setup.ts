/**
 * Setup isolir PPPoE di Mikrotik (pool, profile, firewall, web-proxy).
 * Referensi: mikrotik/proses_isolir.php (ROS6 vs ROS7).
 */
import type { RouterOSClient } from "@/lib/routeros-client";

export type IsolirRosType = "ros6" | "ros7";

export const ISOLIR_POOL_GATEWAY = "10.128.135.1";
export const ISOLIR_POOL_RANGE = "10.128.135.2-10.128.135.254";
export const ISOLIR_POOL_SUBNET = "10.128.135.0/24";
export const ISOLIR_ADDRESS_LIST = "isolir-list";
export const ISOLIR_PROXY_PORT = "8085";
export const ISOLIR_DEFAULT_PROFILE = "isolir";

export type IsolirSetupInput = {
  rosType: IsolirRosType;
  /** IP publik / gateway internet untuk redirect halaman isolir (contoh: 172.16.1.1) */
  gatewayIp: string;
  profileName?: string;
};

export type IsolirSetupStep = {
  key: string;
  label: string;
  status: "created" | "skipped" | "updated";
};

export type IsolirSetupResult = {
  steps: IsolirSetupStep[];
};

async function printFiltered(
  api: RouterOSClient,
  path: string,
  filters: Record<string, string>
): Promise<Record<string, string>[]> {
  const segments = [
    path,
    ...Object.entries(filters).map(([k, v]) => `?${k}=${v}`),
  ];
  const rows = await api.write(segments);
  return (Array.isArray(rows) ? rows : []) as Record<string, string>[];
}

async function ensureAdd(
  api: RouterOSClient,
  printPath: string,
  filters: Record<string, string>,
  addSegments: string[],
  label: string,
  key: string
): Promise<IsolirSetupStep> {
  const existing = await printFiltered(api, printPath, filters);
  if (existing.length > 0) {
    return { key, label, status: "skipped" };
  }
  await api.write(addSegments);
  return { key, label, status: "created" };
}

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export function normalizeGatewayIp(value: string): string {
  const trimmed = value.trim();
  if (!IPV4_RE.test(trimmed)) {
    throw new Error("IP gateway internet tidak valid (format IPv4)");
  }
  return trimmed;
}

export function normalizeProfileName(value?: string): string {
  const name = (value?.trim() || ISOLIR_DEFAULT_PROFILE).slice(0, 32);
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error(
      "Nama profil isolir hanya boleh huruf, angka, strip, dan underscore"
    );
  }
  return name;
}

export async function applyIsolirSetup(
  api: RouterOSClient,
  input: IsolirSetupInput
): Promise<IsolirSetupResult> {
  const gatewayIp = normalizeGatewayIp(input.gatewayIp);
  const profileName = normalizeProfileName(input.profileName);
  const redirectTarget = `${gatewayIp}:${ISOLIR_PROXY_PORT}`;
  const steps: IsolirSetupStep[] = [];

  steps.push(
    await ensureAdd(
      api,
      "/ip/pool/print",
      { name: profileName },
      [
        "/ip/pool/add",
        `=name=${profileName}`,
        `=ranges=${ISOLIR_POOL_RANGE}`,
      ],
      `IP pool "${profileName}"`,
      "pool"
    )
  );

  steps.push(
    await ensureAdd(
      api,
      "/ppp/profile/print",
      { name: profileName },
      [
        "/ppp/profile/add",
        `=name=${profileName}`,
        `=local-address=${ISOLIR_POOL_GATEWAY}`,
        `=remote-address=${profileName}`,
        `=address-list=${ISOLIR_ADDRESS_LIST}`,
      ],
      `PPP profile "${profileName}"`,
      "profile"
    )
  );

  steps.push(
    await ensureAdd(
      api,
      "/ip/firewall/filter/print",
      { comment: "Drop PPPoe Isolir" },
      [
        "/ip/firewall/filter/add",
        "=chain=forward",
        `=src-address-list=${ISOLIR_ADDRESS_LIST}`,
        "=action=drop",
        "=comment=Drop PPPoe Isolir",
      ],
      "Firewall filter (drop isolir)",
      "filter"
    )
  );

  steps.push(
    await ensureAdd(
      api,
      "/ip/firewall/nat/print",
      { comment: "NAT PPPoE isolir to warning" },
      [
        "/ip/firewall/nat/add",
        "=chain=dstnat",
        `=src-address-list=${ISOLIR_ADDRESS_LIST}`,
        "=protocol=tcp",
        "=dst-port=80,443",
        "=action=redirect",
        `=to-ports=${ISOLIR_PROXY_PORT}`,
        "=comment=NAT PPPoE isolir to warning",
      ],
      "Firewall NAT (redirect 80/443)",
      "nat"
    )
  );

  await api.write([
    "/ip/proxy/set",
    "=enabled=yes",
    `=port=${ISOLIR_PROXY_PORT}`,
    "=max-cache-size=unlimited",
  ]);
  steps.push({
    key: "proxy",
    label: "Web proxy (port 8085)",
    status: "updated",
  });

  const access1Existing = await printFiltered(api, "/ip/proxy/access/print", {
    "src-address": ISOLIR_POOL_SUBNET,
    "dst-port": "80",
  });

  if (access1Existing.length === 0) {
    const access1 =
      input.rosType === "ros7"
        ? [
            "/ip/proxy/access/add",
            `=src-address=${ISOLIR_POOL_SUBNET}`,
            `=dst-address=!${ISOLIR_POOL_GATEWAY}`,
            "=dst-port=80",
            "=dst-host=!winet.id",
            "=action=redirect",
            `=action-data=${redirectTarget}`,
          ]
        : [
            "/ip/proxy/access/add",
            `=src-address=${ISOLIR_POOL_SUBNET}`,
            `=dst-address=!${ISOLIR_POOL_GATEWAY}`,
            "=dst-port=80",
            "=dst-host=!winet.id",
            "=action=deny",
            `=redirect-to=${redirectTarget}`,
          ];
    await api.write(access1);
    steps.push({
      key: "proxy-access-http",
      label: `Proxy access HTTP (${input.rosType === "ros7" ? "redirect" : "deny+redirect-to"})`,
      status: "created",
    });
  } else {
    steps.push({
      key: "proxy-access-http",
      label: "Proxy access HTTP",
      status: "skipped",
    });
  }

  steps.push(
    await ensureAdd(
      api,
      "/ip/proxy/access/print",
      { "src-address": ISOLIR_POOL_SUBNET, "dst-port": ISOLIR_PROXY_PORT },
      [
        "/ip/proxy/access/add",
        `=src-address=${ISOLIR_POOL_SUBNET}`,
        `=dst-port=${ISOLIR_PROXY_PORT}`,
        "=action=allow",
      ],
      "Proxy access port 8085 (allow)",
      "proxy-access-local"
    )
  );

  return { steps };
}

export const ISOLIR_SETUP_CHECKLIST = [
  "Membuat IP pool isolir (segment 10.128.135.0/24)",
  "Membuat firewall filter & NAT redirect ke web proxy",
  "Mengaktifkan web proxy port 8085",
  "Membuat profile PPP isolir",
  "ROS6: proxy access action deny + redirect-to",
  "ROS7: proxy access action redirect + action-data",
  "Setelah proses: Reset HTML web proxy, lalu ganti Files/webproxy/error.html",
] as const;

/** Nama file halaman isolir di Mikrotik (folder Files → webproxy). */
export const ISOLIR_MIKROTIK_HTML_FILE = "error.html";
export const ISOLIR_MIKROTIK_HTML_PATH = `webproxy/${ISOLIR_MIKROTIK_HTML_FILE}`;
