import { validateRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canAccessSensitiveUserUpload } from "@/lib/rbac";
import { isSafeIdentityUploadFilename } from "@/lib/identity-upload-filename";
import {
  USER_IDENTITY_UPLOAD_DIR,
} from "@/lib/user-upload-path";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
};

export async function GET(
  _request: NextRequest,
  segmentData: { params: Promise<{ name: string }> }
) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });

  const { name: rawName } = await segmentData.params;
  const name = path.basename(decodeURIComponent(rawName));
  if (!isSafeIdentityUploadFilename(name)) {
    return NextResponse.json({ error: "Nama file tidak valid" }, { status: 400 });
  }

  const owner = await prisma.user.findFirst({
    where: { OR: [{ file_identitas: name }, { file_npwp: name }] },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }

  if (!(await canAccessSensitiveUserUpload(user, owner.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const primary = path.join(USER_IDENTITY_UPLOAD_DIR, name);
  if (!fs.existsSync(primary)) {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }
  const filePath = primary;

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = EXT_MIME[ext] ?? "application/octet-stream";
  const buf = fs.readFileSync(filePath);
  const asciiName = name.replace(/[^\x20-\x7E]/g, "_");
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
