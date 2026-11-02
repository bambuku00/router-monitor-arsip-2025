"use server";

import { validateRequest } from "@/lib/auth";
import {
  canConfigureRegulatorySettings,
  canManageRegulatoryScope,
  getRegulatoryScopeUserId,
} from "@/lib/regulatory-access";
import {
  DEFAULT_REGULATORY_SETTINGS,
  validateRegulatoryPercents,
} from "@/lib/regulatory-calc";
import prisma from "@/lib/prisma";

async function requireRegulatorySettingsUser() {
  const { user } = await validateRequest();
  if (!user || !canConfigureRegulatorySettings(user)) {
    return { error: "Unauthorized" as const, user: null };
  }
  return { user, error: null };
}

export async function getOrCreateRegulatorySettings(mitraUserId?: number) {
  const auth = await requireRegulatorySettingsUser();
  if (auth.error || !auth.user) return { error: auth.error };

  if (auth.user.role === "Superadmin" && mitraUserId == null) {
    return { error: "Pilih mitra terlebih dahulu" };
  }

  const scopeId = mitraUserId ?? getRegulatoryScopeUserId(auth.user);
  if (!canManageRegulatoryScope(auth.user, scopeId)) {
    return { error: "Unauthorized" };
  }

  const existing = await prisma.regulatorySettings.findUnique({
    where: { userId: scopeId },
    include: {
      user: { select: { id: true, nama: true } },
    },
  });

  if (existing) return { data: existing };

  return {
    data: {
      id: 0,
      userId: scopeId,
      ...DEFAULT_REGULATORY_SETTINGS,
      created: new Date(),
      updated: new Date(),
      user: { id: scopeId, nama: "" },
    },
  };
}

export type SaveRegulatorySettingsInput = {
  mitraUserId?: number;
  bhpEnabled: boolean;
  bhpPercent: number;
  usoEnabled: boolean;
  usoPercent: number;
};

export async function saveRegulatorySettings(input: SaveRegulatorySettingsInput) {
  const auth = await requireRegulatorySettingsUser();
  if (auth.error || !auth.user) return { error: auth.error };

  const scopeId = input.mitraUserId ?? getRegulatoryScopeUserId(auth.user);
  if (auth.user.role === "Superadmin" && input.mitraUserId == null) {
    return { error: "Pilih mitra terlebih dahulu" };
  }
  if (!canManageRegulatoryScope(auth.user, scopeId)) {
    return { error: "Unauthorized" };
  }

  const percentError = validateRegulatoryPercents(
    input.bhpPercent,
    input.usoPercent
  );
  if (percentError) return { error: percentError };

  const data = await prisma.regulatorySettings.upsert({
    where: { userId: scopeId },
    create: {
      userId: scopeId,
      bhpEnabled: input.bhpEnabled,
      bhpPercent: input.bhpPercent,
      usoEnabled: input.usoEnabled,
      usoPercent: input.usoPercent,
      calculationBasis: "INVOICE_CREATED",
    },
    update: {
      bhpEnabled: input.bhpEnabled,
      bhpPercent: input.bhpPercent,
      usoEnabled: input.usoEnabled,
      usoPercent: input.usoPercent,
      calculationBasis: "INVOICE_CREATED",
    },
  });

  return { data, message: "Pengaturan BHP/USO berhasil disimpan" };
}
