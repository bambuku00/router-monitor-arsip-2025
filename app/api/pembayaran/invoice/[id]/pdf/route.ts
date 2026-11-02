import { validateRequest } from "@/lib/auth";
import { getPembayaranInScope } from "@/lib/authz";
import { buildBulkInvoicePdf } from "@/lib/invoice-bulk-pdf";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { user, session } = await validateRequest();
  if (!session || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;

  const { id: idStr } = await segmentData.params;
  const pembayaranId = parseInt(idStr, 10);
  if (Number.isNaN(pembayaranId)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  const inScope = await getPembayaranInScope(pembayaranId, user);
  if (!inScope) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const { buffer, pdfName } = await buildBulkInvoicePdf(user, [pembayaranId]);
    const inline = request.nextUrl.searchParams.get("download") !== "1";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${
          inline ? "inline" : "attachment"
        }; filename="${pdfName}"`,
        "Cache-Control": "no-store",
        "X-Invoice-Count": "1",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      message.includes("Akses") || message.includes("tidak valid")
        ? 403
        : message.includes("Tidak ada")
          ? 404
          : 500;
    console.error("Invoice PDF error:", err);
    return NextResponse.json(
      {
        error: message || "Gagal membuat PDF invoice",
        ...(process.env.NODE_ENV === "development" ? { detail: message } : {}),
      },
      { status }
    );
  }
}
