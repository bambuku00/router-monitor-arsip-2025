import { validateRequest } from "@/lib/auth";
import { invoiceBarcodeDataUri } from "@/lib/invoice-resolve-assets";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "Admin" && user.role !== "Superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const text = request.nextUrl.searchParams.get("text") ?? "-";
  if (text.length > 128) {
    return NextResponse.json({ error: "Teks terlalu panjang" }, { status: 400 });
  }

  try {
    const dataUri = await invoiceBarcodeDataUri(text);
    return NextResponse.json({ dataUri });
  } catch {
    return NextResponse.json({ error: "Gagal membuat barcode" }, { status: 500 });
  }
}
