/** Map string versi RouterOS (mis. "7.15.2") ke nilai os_version di DB. */
export function mapRouterOsVersionString(
  version: string
): "v6" | "v7" | null {
  const trimmed = version.trim();
  if (!trimmed) return null;

  const major = parseInt(trimmed.split(".")[0] ?? "", 10);
  if (Number.isNaN(major)) return null;
  if (major >= 7) return "v7";
  if (major >= 6) return "v6";
  if (major >= 5) return "v6";
  return null;
}

export function formatRouterOsVersionLabel(
  osVersion: "v6" | "v7",
  version?: string | null
): string {
  const base = osVersion === "v7" ? "RouterOS v7" : "RouterOS v6";
  if (!version?.trim()) return base;
  return `${base} (${version.trim()})`;
}
