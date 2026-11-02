import { validateRequest } from "@/lib/auth";
import {
  assertScopedStaffMayUseRouterLevelPpp,
  getRouterForUser,
} from "@/lib/authz";
import {
  applyCustomerDirectoryToAutoFilled,
  formatCustomerDirectoryImportSummary,
} from "@/lib/ppp-bulk-fill-pelanggan";
import {
  buildPppCustomerDirectory,
  csvHasCustomerDirectoryHeader,
} from "@/lib/ppp-customer-directory";
import { revalidatePPP } from "@/lib/server-actions/router/ppp/actions";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const MAX_CSV_CHARS = 1_000_000;

const BodySchema = z.object({
  csv: z.string().min(1).max(MAX_CSV_CHARS),
});

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });

  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;

  const scoped = await assertScopedStaffMayUseRouterLevelPpp(user);
  if (!scoped.ok) {
    return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  }

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

  let csv = "";
  try {
    const raw = await request.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "File CSV kosong atau terlalu besar." },
        { status: 400 }
      );
    }
    csv = parsed.data.csv;
  } catch {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  if (!csvHasCustomerDirectoryHeader(csv)) {
    return NextResponse.json(
      { error: "Kolom wajib: pelanggan, username, no_wa, alamat." },
      { status: 400 }
    );
  }

  const directory = buildPppCustomerDirectory(csv);
  if (directory.size === 0) {
    return NextResponse.json(
      { error: "Tidak ada baris pelanggan di file." },
      { status: 400 }
    );
  }

  try {
    const result = await applyCustomerDirectoryToAutoFilled(routerId, directory);
    await revalidatePPP();
    return NextResponse.json({
      data: result,
      message: formatCustomerDirectoryImportSummary(result),
    });
  } catch (err) {
    return errorApiResponse(err);
  }
}
