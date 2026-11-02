/** Secret PPPoE di MikroTik dianggap aktif jika tidak disabled. */
export function isMikrotikPppSecretActive(secret: { disabled?: string | null }): boolean {
  const disabled = String(secret.disabled ?? "").trim().toLowerCase();
  return disabled !== "true" && disabled !== "yes";
}

/** Secret di-disable di MikroTik (tidak bisa login), online maupun tidak. */
export function isPppSecretDisabled(secret: { disabled?: string | null }): boolean {
  return !isMikrotikPppSecretActive(secret);
}
