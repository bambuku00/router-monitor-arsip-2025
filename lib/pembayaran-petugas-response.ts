import type { RoleName } from "@prisma/client";

export type StaffInputterRecord = {
  id: number;
  nama: string;
  user?: string;
  role?: RoleName;
};

/** Petugas tidak menerima direktori mitra: inputter, router, dan hari proses global. */
export function visibleInputter(
  role: RoleName,
  inputter: StaffInputterRecord | null
): StaffInputterRecord | { id: number; nama: string } | null {
  if (!inputter) return null;
  if (role !== "Petugas") return inputter;
  return { id: inputter.id, nama: inputter.nama };
}

/** Username PPPoE hanya untuk staf kantor. Petugas tidak melihat dan tidak menerima field ini. */
export function showsPppUsername(role: RoleName): boolean {
  return role !== "Petugas";
}

export function pppSecretForAudience<T extends { name?: string | null }>(
  role: RoleName,
  secret: T | null | undefined
): T | Omit<T, "name"> | null {
  if (secret == null) return null;
  if (showsPppUsername(role)) return secret;
  const { name: _name, ...rest } = secret;
  return rest;
}

export function cetakDataForAudience<
  T extends {
    belum: Array<{ pelanggan: { ppp_secret: { name: string } | null } }>;
    terbayar: Array<{ pelanggan: { ppp_secret: { name: string } | null } }>;
  },
>(role: RoleName, data: T): T {
  if (showsPppUsername(role)) return data;
  const strip = <R extends (typeof data.belum)[number]>(rows: R[]): R[] =>
    rows.map((row) => ({
      ...row,
      pelanggan: { ...row.pelanggan, ppp_secret: null },
    }));
  return {
    ...data,
    belum: strip(data.belum),
    terbayar: strip(data.terbayar),
  };
}

export function tagihanServiceDescription(
  role: RoleName,
  routerName: string,
  pppName: string,
  periodeLabel: string
): string {
  if (!showsPppUsername(role)) {
    return `Tagihan internet ${routerName} — periode ${periodeLabel}`;
  }
  return `Tagihan internet ${routerName} — PPP ${pppName} — periode ${periodeLabel}`;
}

export function hidesMitraDirectory(role: RoleName): boolean {
  return role === "Petugas";
}

export function valuesForAudience<T>(role: RoleName, values: T[]): T[] {
  return role === "Petugas" ? [] : values;
}

export type StatusActorFields = {
  isolirOleh: string | null;
  bukaIsolirOleh: string | null;
  berhentiOleh: string | null;
  lanjutOleh: string | null;
};

/** Petugas tidak menerima nama atau username pelaku isolir, berhenti, dan lanjut. */
export function statusActorsForAudience<T extends StatusActorFields>(
  role: RoleName,
  actors: T
): T {
  if (role !== "Petugas") return actors;
  return {
    ...actors,
    isolirOleh: null,
    bukaIsolirOleh: null,
    berhentiOleh: null,
    lanjutOleh: null,
  };
}

export function pelangganListExtrasForAudience(
  role: RoleName,
  extras: { mitraPpn: number | null; autoIsolirEnabled: boolean }
): { mitraPpn: number | null; autoIsolirEnabled?: boolean } {
  if (role === "Petugas") return { mitraPpn: extras.mitraPpn };
  return extras;
}

export function tagihanPayloadForAudience<
  T extends {
    total: number;
    belum: number;
    terbayar: number;
    tunai?: number;
    transfer?: number;
    jumlahTunai?: number;
    jumlahTransfer?: number;
  },
>(
  role: RoleName,
  stat: T,
  regulatory: unknown,
  ppp: unknown
):
  | (T & { regulatory: unknown; ppp: unknown })
  | {
      total: number;
      belum: number;
      terbayar: number;
      tunai: number;
      transfer: number;
      jumlahTunai: number;
      jumlahTransfer: number;
      regulatory: null;
      ppp: null;
    } {
  if (role !== "Petugas") {
    return { ...stat, regulatory, ppp };
  }
  return {
    total: stat.total,
    belum: stat.belum,
    terbayar: stat.terbayar,
    tunai: stat.tunai ?? 0,
    transfer: stat.transfer ?? 0,
    jumlahTunai: stat.jumlahTunai ?? 0,
    jumlahTransfer: stat.jumlahTransfer ?? 0,
    regulatory: null,
    ppp: null,
  };
}
