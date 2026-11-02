import { z } from "zod";

/** Schema untuk tambah PPP secret. Dipakai di API route dan proxy MikroTik. */
export const AddPPPSchema = z.object({
  name: z
    .string()
    .min(3, "Name minimal 3 karakter")
    .max(50)
    .regex(
      /^[a-zA-Z0-9_.@-]+$/,
      "Name hanya boleh huruf, angka, underscore, titik, strip, atau @"
    ),
  password: z
    .string()
    .min(3, "Password minimal 3 karakter")
    .max(100),
  profile: z.string().max(64).optional(),
  service: z.enum(["any", "pppoe", "pptp", "l2tp", "sstp", "ovpn"]).optional(),
  comment: z.string().max(255).optional(),
  localAddress: z.string().ip().optional().or(z.literal("")),
  remoteAddress: z.string().ip().optional().or(z.literal("")),
});

export type AddPPPData = z.infer<typeof AddPPPSchema>;

export function validatePPPAdd(
  body: unknown
): { success: true; data: AddPPPData } | { success: false; error: string } {
  const parsed = AddPPPSchema.safeParse(body);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  const first = parsed.error.flatten().fieldErrors;
  const msg =
    Object.entries(first)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
      .join("; ") || "Validation failed";
  return { success: false, error: msg };
}

/**
 * Parse payload array dari proxy MikroTik (e.g. ["=name=foo", "=password=bar"])
 * ke object untuk validasi. Field "local-address" -> localAddress, "remote-address" -> remoteAddress.
 */
export function parseProxyPayload(data: unknown): Record<string, string> {
  const obj: Record<string, string> = {};
  if (!Array.isArray(data)) return obj;
  for (const item of data) {
    if (typeof item !== "string" || !item.startsWith("=")) continue;
    const secondEq = item.indexOf("=", 1);
    if (secondEq === -1) continue;
    const key = item.slice(1, secondEq);
    const value = item.slice(secondEq + 1);
    if (key === "local-address") obj.localAddress = value;
    else if (key === "remote-address") obj.remoteAddress = value;
    else obj[key] = value;
  }
  return obj;
}
