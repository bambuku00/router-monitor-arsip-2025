import { validateRequest } from "@/lib/auth";
import {
  assertScopedStaffMayUseRouterLevelPpp,
  getRouterForUser,
} from "@/lib/authz";
import { bulkFillPelangganFromPpp, formatBulkFillPelangganSummary } from "@/lib/ppp-bulk-fill-pelanggan";
import { revalidatePPP } from "@/lib/server-actions/router/ppp/actions";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  defaultPaketId: z.number().int().positive().optional(),
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

  let defaultPaketId: number | undefined;
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    defaultPaketId = parsed.data.defaultPaketId;
  } catch {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  try {
    const result = await bulkFillPelangganFromPpp(routerId, user.id, {
      defaultPaketId,
      mode: "manual",
    });

    await revalidatePPP();

    return NextResponse.json({
      data: result,
      message: formatBulkFillPelangganSummary(result),
    });
  } catch (err) {
    return errorApiResponse(err);
  }
}
