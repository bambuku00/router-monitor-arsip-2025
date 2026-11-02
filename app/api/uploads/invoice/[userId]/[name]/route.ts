import { validateRequest } from "@/lib/auth";
import {
  invoiceUploadDirForUser,
  isSafeInvoiceUploadFilename,
} from "@/lib/invoice-upload-path";
import { canAccessSensitiveUserUpload } from "@/lib/rbac";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _request: NextRequest,
  segmentData: { params: Promise<{ userId: string; name: string }> }
) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });

  const { userId: userIdStr, name: rawName } = await segmentData.params;
  const userId = parseInt(userIdStr, 10);
  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const name = path.basename(decodeURIComponent(rawName));
  if (!isSafeInvoiceUploadFilename(name)) {
    return NextResponse.json({ error: "Nama file tidak valid" }, { status: 400 });
  }

  if (!(await canAccessSensitiveUserUpload(user, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filePath = path.join(invoiceUploadDirForUser(userId), name);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = EXT_MIME[ext] ?? "application/octet-stream";
  const buf = fs.readFileSync(filePath);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
