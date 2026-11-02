import prisma from "@/lib/prisma";

export type MitraPpnPolicy = {
  ppnEnabled: boolean;
  ppnPercent: number;
};

/** Baris Superadmin utama (ISP) — pengaturan PPN global. */
export async function getSuperadminPpnSettings(): Promise<{
  ppnEnabled: boolean;
  ppn: number | null;
}> {
  const row = await prisma.user.findFirst({
    where: { role: "Superadmin", disabled: false },
    orderBy: { id: "asc" },
    select: { ppnEnabled: true, ppn: true },
  });
  return {
    ppnEnabled: row?.ppnEnabled !== false,
    ppn: row?.ppn ?? null,
  };
}

/** Tarif efektif mitra: hormati pematian PPN di Superadmin. */
export async function resolveMitraPpnPolicy(
  mitraUserId: number
): Promise<MitraPpnPolicy> {
  const [isp, mitra] = await Promise.all([
    getSuperadminPpnSettings(),
    prisma.user.findUnique({
      where: { id: mitraUserId },
      select: { ppn: true },
    }),
  ]);

  if (!isp.ppnEnabled) {
    return { ppnEnabled: false, ppnPercent: 0 };
  }

  const ppnPercent = mitra?.ppn ?? isp.ppn ?? 11;
  return { ppnEnabled: true, ppnPercent };
}

export function effectivePpnPercentFromPolicy(policy: MitraPpnPolicy): number {
  return policy.ppnEnabled ? policy.ppnPercent : 0;
}
