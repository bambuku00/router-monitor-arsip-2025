import dns from "node:dns/promises";
import net from "node:net";

function hostWithoutPort(raw: string): string {
  const h = raw.trim();
  if (!h) return h;
  if (h.startsWith("[") && h.includes("]")) {
    return h.slice(1, h.indexOf("]"));
  }
  if (h.includes(":") && !net.isIPv6(h)) {
    const lastColon = h.lastIndexOf(":");
    const maybePort = h.slice(lastColon + 1);
    if (/^\d{1,5}$/.test(maybePort)) return h.slice(0, lastColon);
  }
  return h;
}

/**
 * Strip IPv6 zone identifiers (%lo, %eth0, %25eth0, …) BEFORE policy evaluation.
 * Zone forms previously bypassed mapped-IPv4 loopback checks (e.g. ::ffff:127.0.0.1%lo).
 * Returns null when the zone is present but empty/malformed.
 */
function stripIpv6ZoneId(host: string): string | null {
  const pct = host.indexOf("%");
  if (pct === -1) return host;
  if (pct === 0) return null;
  const zone = host.slice(pct + 1);
  // Empty zone ("::1%") or zone containing another % is invalid
  if (!zone || zone.includes("%")) return null;
  return host.slice(0, pct);
}

/**
 * Expand IPv6 (including dotted-quad IPv4-mapped suffix) to 8 hextets 0–65535.
 * Returns null if the address is not a valid IPv6 literal.
 */
function expandIpv6Hextets(ip: string): number[] | null {
  if (!net.isIPv6(ip)) return null;

  let s = ip.toLowerCase();
  // Convert trailing dotted IPv4 (e.g. ::ffff:127.0.0.1) to two hextets
  const dotted = s.match(/^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) {
    const parts = dotted[2]!.split(".").map((x) => Number(x));
    if (
      parts.length !== 4 ||
      parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
    ) {
      return null;
    }
    const hi = ((parts[0]! << 8) | parts[1]!).toString(16);
    const lo = ((parts[2]! << 8) | parts[3]!).toString(16);
    s = `${dotted[1]}${hi}:${lo}`;
  }

  if (s.includes("::")) {
    const [leftRaw, rightRaw] = s.split("::");
    const left = leftRaw ? leftRaw.split(":").filter(Boolean) : [];
    const right = rightRaw ? rightRaw.split(":").filter(Boolean) : [];
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    const filled = [
      ...left,
      ...Array.from({ length: missing }, () => "0"),
      ...right,
    ];
    if (filled.length !== 8) return null;
    const nums = filled.map((h) => parseInt(h, 16));
    if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) return null;
    return nums;
  }

  const parts = s.split(":");
  if (parts.length !== 8) return null;
  const nums = parts.map((h) => parseInt(h, 16));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) return null;
  return nums;
}

/** If IPv4-mapped IPv6 (::ffff:0:0/96), return dotted IPv4; else null. */
function ipv4FromMappedIpv6(hextets: number[]): string | null {
  // ::ffff:x.x.x.x  => 0:0:0:0:0:ffff:hi:lo
  if (
    hextets[0] === 0 &&
    hextets[1] === 0 &&
    hextets[2] === 0 &&
    hextets[3] === 0 &&
    hextets[4] === 0 &&
    hextets[5] === 0xffff
  ) {
    const hi = hextets[6]!;
    const lo = hextets[7]!;
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }
  return null;
}

function ipv4RejectReason(ip: string, allowPrivate: boolean): string | null {
  if (!net.isIPv4(ip)) return "Alamat host tidak valid";
  const parts = ip.split(".").map((x) => Number(x));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return "Alamat host tidak valid";
  }
  const [a, b, c, d] = parts;
  if (a === 0 || a === 127) return "Alamat host tidak diizinkan untuk koneksi MikroTik";
  if (a === 169 && b === 254) {
    return "Alamat host tidak diizinkan (link-local / metadata)";
  }
  // IPv4 multicast 224.0.0.0/4
  if (a! >= 224 && a! <= 239) {
    return "Alamat IPv4 multicast tidak diizinkan";
  }
  // IPv4 limited broadcast
  if (a === 255 && b === 255 && c === 255 && d === 255) {
    return "Alamat IPv4 broadcast tidak diizinkan";
  }
  if (!allowPrivate) {
    if (a === 10) return "IP privat tidak diizinkan. Set ROUTEROS_PROXY_ALLOW_PRIVATE_HOSTS=true jika router di LAN.";
    if (a === 172 && b! >= 16 && b! <= 31) {
      return "IP privat tidak diizinkan. Set ROUTEROS_PROXY_ALLOW_PRIVATE_HOSTS=true jika router di LAN.";
    }
    if (a === 192 && b === 168) {
      return "IP privat tidak diizinkan. Set ROUTEROS_PROXY_ALLOW_PRIVATE_HOSTS=true jika router di LAN.";
    }
  }
  return null;
}

function ipv6RejectReason(ip: string, allowPrivate: boolean): string | null {
  const hextets = expandIpv6Hextets(ip);
  if (!hextets) return "Alamat host tidak valid";

  const mappedV4 = ipv4FromMappedIpv6(hextets);
  if (mappedV4) return ipv4RejectReason(mappedV4, allowPrivate);

  // Unspecified ::
  if (hextets.every((h) => h === 0)) {
    return "Alamat host tidak diizinkan untuk koneksi MikroTik";
  }
  // Loopback ::1
  if (
    hextets[0] === 0 &&
    hextets[1] === 0 &&
    hextets[2] === 0 &&
    hextets[3] === 0 &&
    hextets[4] === 0 &&
    hextets[5] === 0 &&
    hextets[6] === 0 &&
    hextets[7] === 1
  ) {
    return "Alamat host tidak diizinkan untuk koneksi MikroTik";
  }
  // Multicast ff00::/8
  if ((hextets[0]! & 0xff00) === 0xff00) {
    return "Alamat IPv6 multicast tidak diizinkan";
  }
  // Link-local fe80::/10
  if ((hextets[0]! & 0xffc0) === 0xfe80) {
    return "Alamat IPv6 link-local tidak diizinkan";
  }
  // ULA fc00::/7
  if (!allowPrivate && (hextets[0]! & 0xfe00) === 0xfc00) {
    return "IPv6 ULA tidak diizinkan. Set ROUTEROS_PROXY_ALLOW_PRIVATE_HOSTS=true jika diperlukan.";
  }
  return null;
}

function rejectForResolvedAddr(addr: string, allowPrivate: boolean): string | null {
  if (net.isIPv4(addr)) return ipv4RejectReason(addr, allowPrivate);
  if (net.isIPv6(addr)) return ipv6RejectReason(addr, allowPrivate);
  return "Alamat host tidak valid";
}

function allowPrivateHosts(): boolean {
  const raw = process.env.ROUTEROS_PROXY_ALLOW_PRIVATE_HOSTS
    ?.trim()
    .replace(/^["']|["']$/g, "")
    .toLowerCase();
  return raw === "true" || raw === "1";
}

/**
 * Host literal untuk dial oleh RouterOSClient.
 * Untuk hostname: dua kali dns.lookup berurutan; irisan alamat harus tidak kosong
 * (mitigasi DNS rebinding saat TTL pendek), lalu koneksi memakai IP yang dipilih dari irisan.
 */
export async function resolveMikrotikProxyConnectHost(rawHost: string): Promise<string> {
  const strippedPort = hostWithoutPort(rawHost);
  const host = stripIpv6ZoneId(strippedPort);
  if (host === null) {
    throw new Error("Alamat host tidak valid (zone identifier)");
  }
  if (!host || host.length > 253) {
    throw new Error("Host router tidak valid");
  }

  const allowPrivate = allowPrivateHosts();

  if (net.isIPv4(host)) {
    const r = ipv4RejectReason(host, allowPrivate);
    if (r) throw new Error(r);
    return host;
  }
  if (net.isIPv6(host)) {
    const r = ipv6RejectReason(host, allowPrivate);
    if (r) throw new Error(r);
    // Prefer dotted IPv4 when mapped so dials use the unwrapped form
    const hextets = expandIpv6Hextets(host);
    const mapped = hextets ? ipv4FromMappedIpv6(hextets) : null;
    return mapped ?? host;
  }

  let addrs1: string[];
  try {
    const res = await dns.lookup(host, { all: true, verbatim: true });
    addrs1 = res.map((x) => x.address);
  } catch {
    throw new Error("Host router tidak dapat di-resolusi");
  }
  if (addrs1.length === 0) throw new Error("Host router tidak memiliki alamat IP");
  for (const addr of addrs1) {
    const r = rejectForResolvedAddr(addr, allowPrivate);
    if (r) throw new Error(r);
  }

  let addrs2: string[];
  try {
    const res2 = await dns.lookup(host, { all: true, verbatim: true });
    addrs2 = res2.map((x) => x.address);
  } catch {
    throw new Error("Host router tidak dapat di-resolusi (validasi ulang)");
  }
  if (addrs2.length === 0) throw new Error("Host router tidak memiliki alamat IP (validasi ulang)");
  for (const addr of addrs2) {
    const r = rejectForResolvedAddr(addr, allowPrivate);
    if (r) throw new Error(r);
  }

  const set2 = new Set(addrs2);
  const intersection = addrs1.filter((a) => set2.has(a));
  if (intersection.length === 0) {
    throw new Error("Resolusi DNS tidak stabil (mitigasi DNS rebinding)");
  }

  intersection.sort();
  return intersection[0]!;
}

/**
 * Validasi host saja (tanpa mengembalikan IP pin). Prefer `resolveMikrotikProxyConnectHost` di jalur koneksi.
 */
export async function enforceMikrotikProxyHostPolicy(rawHost: string): Promise<void> {
  await resolveMikrotikProxyConnectHost(rawHost);
}
