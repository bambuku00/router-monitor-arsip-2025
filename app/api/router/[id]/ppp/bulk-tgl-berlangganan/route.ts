import { validateRequest } from "@/lib/auth";
import { getRouterForUser } from "@/lib/authz";
import { bulkSetPelangganBulanBerlangganan } from "@/lib/ppp-bulk-tgl-berlangganan";
import { errorApiResponse } from "@/lib/server-actions/api";
import { revalidatePPP } from "@/lib/server-actions/router/ppp/actions";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const YearMonth = z.string().regex(/^\d{4}-\d{2}$/);
const YearMonthDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const BodySchema = z.object({
  dari: YearMonthDay,
  ke: YearMonth,
  hari: z.number().int().min(1).max(31).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  if (user.role !== "Superadmin") {
    return NextResponse.json(
      { error: "Hanya superadmin yang boleh mengubah bulan berlangganan sekaligus" },
      { status: 403 }
    );
  }

  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;

  const params = await segmentData.params;
  const routerId = parseInt(params.id, 10);
  if (!params.id || Number.isNaN(routerId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const routerCheck = await getRouterForUser(routerId, user);
  if (!routerCheck) {
    return NextResponse.json(
      { error: "Router tidak ditemukan atau akses ditolak" },
      { status: 403 }
    );
  }

  const raw = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Pilih tanggal dan bulan yang valid" },
      { status: 400 }
    );
  }

  const hari = parsed.data.hari ?? null;
  if (hari == null && parsed.data.dari.slice(0, 7) === parsed.data.ke) {
    return NextResponse.json(
      { error: "Bulan tujuan harus berbeda dari bulan yang dipilih" },
      { status: 400 }
    );
  }

  try {
    const result = await bulkSetPelangganBulanBerlangganan(
      routerId,
      user,
      parsed.data.dari,
      parsed.data.ke,
      hari
    );
    await revalidatePPP();

    const message =
      result.updated === 0
        ? `Tidak ada pelanggan yang berubah pada ${result.dariLabel}.`
        : result.hari == null
          ? `${result.dariLabel} dipindah ke ${result.keLabel} untuk ${result.updated} pelanggan. Hari masing-masing pelanggan tetap.`
          : `${result.dariLabel} dipindah ke ${result.keLabel} tanggal ${result.hari} untuk ${result.updated} pelanggan.`;

    return NextResponse.json({ data: result, message });
  } catch (err) {
    return errorApiResponse(err);
  }
}
