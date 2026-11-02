import { StatusBayar, type Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import { resolvePenagihanOwner } from "@/lib/penagih";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";

const MAX_KOMISI = 100_000_000;

export type KomisiRingkas = {
  masuk: number;
  dibatalkan: number;
  saldo: number;
  transaksi: number;
};

export type KomisiTx = Pick<
  Prisma.TransactionClient,
  "penagihPenugasan" | "pelanggan" | "komisiPetugasEntri"
>;

/** Nominal rupiah utuh. 0 berarti tanpa komisi. */
export function parseKomisiNominal(
  raw: unknown
): { ok: true; nominal: number } | { ok: false; error: string } {
  if (typeof raw === "boolean" || raw == null || raw === "") {
    return { ok: false, error: "Nominal komisi harus bilangan bulat 0 atau lebih" };
  }
  const nominal = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(nominal) || nominal < 0 || nominal > MAX_KOMISI) {
    return { ok: false, error: "Nominal komisi harus bilangan bulat 0 atau lebih" };
  }
  return { ok: true, nominal };
}

/** Kosong dianggap 0. Dipakai saat tambah dan ubah petugas. */
export function parseKomisiField(
  raw: unknown
): { ok: true; nominal: number } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true, nominal: 0 };
  return parseKomisiNominal(raw);
}

/**
 * Petugas hanya membaca komisinya sendiri.
 * ID petugas lain pada query ditolak.
 */
export function petugasKomisiTarget(
  actorUserId: number,
  requestedUserId: unknown
): { ok: true } | { ok: false } {
  if (requestedUserId == null || requestedUserId === "") return { ok: true };
  const id = Number(requestedUserId);
  if (!Number.isInteger(id) || id !== actorUserId) return { ok: false };
  return { ok: true };
}

export function ringkasKomisi(rows: { nominal: number }[]): KomisiRingkas {
  let masuk = 0;
  let dibatalkan = 0;
  let saldo = 0;
  let transaksi = 0;
  for (const row of rows) {
    saldo += row.nominal;
    if (row.nominal > 0) {
      masuk += row.nominal;
      transaksi += 1;
    } else if (row.nominal < 0) {
      dibatalkan += -row.nominal;
    }
  }
  return { masuk, dibatalkan, saldo, transaksi };
}

/** Pengeluaran pembukuan = saldo komisi pada periode itu. Pembatalan mengurangi nilainya. */
export function rekapKomisiPengeluaran(rows: { nominal: number; created: Date }[]) {
  const monthly = new Array(12).fill(0);
  const daily = new Array(31).fill(0);
  let total = 0;
  for (const row of rows) {
    total += row.nominal;
    const month = row.created.getMonth();
    const day = row.created.getDate() - 1;
    if (month >= 0 && month < 12) monthly[month] += row.nominal;
    if (day >= 0 && day < 31) daily[day] += row.nominal;
  }
  return { total, monthly, daily };
}

export function keteranganKomisi(nominal: number): string {
  return nominal < 0 ? "Pembatalan pembayaran" : "Pembayaran";
}

/**
 * Satu kredit per log lunas. Komisi milik penagih yang ditugaskan pada pelanggan,
 * siapa pun yang menekan Bayar. Pelanggan tanpa penagih, penagih nonaktif, atau tarif 0 tidak menulis baris.
 */
export async function catatKomisiPembayaranPetugas(
  tx: KomisiTx,
  params: {
    actorUserId: number;
    pembayaranId: number;
    pelangganId: number;
    logBayarId: number | null;
  }
): Promise<"created" | "skip"> {
  if (params.logBayarId == null) return "skip";

  const [penugasan, pelanggan] = await Promise.all([
    tx.penagihPenugasan.findUnique({
      where: { pelangganId: params.pelangganId },
      select: {
        penagih: {
          select: { id: true, ownerUserId: true, komisiNominal: true, aktif: true },
        },
      },
    }),
    tx.pelanggan.findUnique({
      where: { id: params.pelangganId },
      select: {
        router: { select: { userId: true } },
      },
    }),
  ]);

  const penagih = penugasan?.penagih;
  if (!penagih || !penagih.aktif || !pelanggan) return "skip";
  if (
    pelanggan.router.userId != null &&
    pelanggan.router.userId !== penagih.ownerUserId
  ) {
    return "skip";
  }

  const nominal = penagih.komisiNominal;
  if (!Number.isInteger(nominal) || nominal <= 0) return "skip";

  const existing = await tx.komisiPetugasEntri.findUnique({
    where: { logBayarId: params.logBayarId },
    select: { id: true },
  });
  if (existing) return "skip";

  await tx.komisiPetugasEntri.create({
    data: {
      ownerUserId: penagih.ownerUserId,
      penagihId: penagih.id,
      actorUserId: params.actorUserId,
      pelangganId: params.pelangganId,
      pembayaranId: params.pembayaranId,
      logBayarId: params.logBayarId,
      nominal,
    },
  });
  return "created";
}

/** Komisi tetap selama tagihan masih lunas, siapa pun yang menekan Bayar. */
export function komisiMasihBerlaku(status: StatusBayar): boolean {
  return status === StatusBayar.Terbayar;
}

/**
 * Menghapus komisi tagihan yang sudah tidak lunas.
 * Tagihan lunas tetap dihitung untuk penagihnya, walau yang menekan Bayar bukan penagih.
 */
export async function hapusKomisiTagihanTidakLunas(
  db: Pick<Prisma.TransactionClient, "komisiPetugasEntri">
): Promise<number> {
  const credits = await db.komisiPetugasEntri.findMany({
    where: { nominal: { gt: 0 }, reversesId: null },
    select: {
      id: true,
      pembayaran: {
        select: { status: true },
      },
    },
  });

  let removed = 0;
  for (const credit of credits) {
    if (komisiMasihBerlaku(credit.pembayaran.status)) continue;
    const reversal = await db.komisiPetugasEntri.findUnique({
      where: { reversesId: credit.id },
      select: { id: true },
    });
    if (reversal) {
      await db.komisiPetugasEntri.delete({ where: { id: reversal.id } });
    }
    await db.komisiPetugasEntri.delete({ where: { id: credit.id } });
    removed += 1;
  }
  return removed;
}

/**
 * Komisi klik Bayar dihapus saat tagihan dibatalkan. Tidak menulis catatan pembatalan.
 * Kredit yang sudah punya baris balik lama dibiarkan, supaya total tidak berkurang dua kali.
 */
export async function batalkanKomisiPembayaran(
  tx: Pick<KomisiTx, "komisiPetugasEntri">,
  pembayaranId: number
): Promise<number> {
  const credits = await tx.komisiPetugasEntri.findMany({
    where: {
      pembayaranId,
      reversesId: null,
      nominal: { gt: 0 },
    },
    orderBy: { id: "asc" },
  });

  let removed = 0;
  for (const credit of credits) {
    const reversed = await tx.komisiPetugasEntri.findUnique({
      where: { reversesId: credit.id },
      select: { id: true },
    });
    if (reversed) continue;

    await tx.komisiPetugasEntri.delete({ where: { id: credit.id } });
    removed += 1;
  }
  return removed;
}

export async function guardKomisiAdmin(
  request: NextRequest,
  mitraFromBody?: unknown
): Promise<
  { ok: true; ownerUserId: number } | { ok: false; response: Response }
> {
  const { user, session } = await validateRequest();
  if (!session || !user) return { ok: false, response: new Response(null, { status: 401 }) };

  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return { ok: false, response: denied };

  const raw = request.nextUrl.searchParams.get("mitraId") ?? mitraFromBody;
  const parsed = raw == null || raw === "" ? null : Number(raw);
  const mitraId = parsed != null && Number.isInteger(parsed) ? parsed : null;
  const scope = await resolvePenagihanOwner(user, mitraId);
  if (!scope.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: scope.error }, { status: scope.status }),
    };
  }
  return { ok: true, ownerUserId: scope.ownerUserId };
}
