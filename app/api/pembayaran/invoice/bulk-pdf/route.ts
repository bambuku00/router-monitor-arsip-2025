import { validateRequest } from "@/lib/auth";
import {
  buildBulkInvoicePdf,
  resolveBulkInvoicePembayaranIds,
} from "@/lib/invoice-bulk-pdf";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BulkPdfBody = {
  ids?: number[];
  mitraUserId?: number;
  bulan?: string;
};

function parseIdList(raw: string | null): number[] | undefined {
  if (!raw?.trim()) return undefined;
  const ids = raw
    .split(",")
    .map((part) => parseInt(part.trim(), 10))
    .filter((id) => Number.isInteger(id) && id > 0);
  return ids.length > 0 ? ids : undefined;
}

async function handleBulkPdf(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;

  let ids: number[] | undefined;
  let mitraUserId: number | undefined;
  let bulan: string | undefined;

  if (request.method === "GET") {
    const sp = request.nextUrl.searchParams;
    ids = parseIdList(sp.get("id") ?? sp.get("ids"));
    const mitraRaw = sp.get("mitraUserId");
    if (mitraRaw) {
      const parsed = parseInt(mitraRaw, 10);
      if (!Number.isNaN(parsed)) mitraUserId = parsed;
    }
    bulan = sp.get("bulan") ?? undefined;
  } else {
    let body: BulkPdfBody;
    try {
      body = (await request.json()) as BulkPdfBody;
    } catch {
      return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
    }
    ids = body.ids;
    mitraUserId = body.mitraUserId;
    bulan = body.bulan;
  }

  try {
    const pembayaranIds = await resolveBulkInvoicePembayaranIds(user, {
      ids,
      mitraUserId,
      bulan,
    });

    const { buffer, count, pdfName } = await buildBulkInvoicePdf(
      user,
      pembayaranIds
    );

    const inline = request.nextUrl.searchParams.get("download") !== "1";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${
          inline ? "inline" : "attachment"
        }; filename="${pdfName}"`,
        "Cache-Control": "no-store",
        "X-Invoice-Count": String(count),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      message.includes("Akses") || message.includes("tidak valid")
        ? 403
        : message.includes("Maksimal") || message.includes("Tidak ada")
          ? 400
          : 500;
    console.error("Bulk invoice PDF error:", err);
    return NextResponse.json(
      {
        error: message || "Gagal membuat PDF invoice",
        ...(process.env.NODE_ENV === "development" ? { detail: message } : {}),
      },
      { status }
    );
  }
}

/** apiwin: unpaid.php?id=664,665,663 */
export async function GET(request: NextRequest) {
  return handleBulkPdf(request);
}

export async function POST(request: NextRequest) {
  return handleBulkPdf(request);
}
