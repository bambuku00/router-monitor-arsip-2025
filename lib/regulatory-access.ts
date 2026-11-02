import type { User } from "lucia";
import { getOwnedResourcesUserId } from "@/lib/rbac";

/** Pengaturan BHP/USO per mitra — hanya Superadmin (form di /users). */
export function canConfigureRegulatorySettings(
  user: Pick<User, "role"> | null
): boolean {
  return user?.role === "Superadmin";
}

export function getRegulatoryScopeUserId(user: User): number {
  if (user.role === "Superadmin") return user.id;
  return getOwnedResourcesUserId(user);
}

export function canManageRegulatoryScope(
  user: User,
  _targetUserId: number
): boolean {
  return user.role === "Superadmin";
}
