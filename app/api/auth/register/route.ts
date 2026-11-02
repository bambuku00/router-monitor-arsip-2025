import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { UserRegister, UserRegisterSchema } from "@/lib/user-types";
import { setNestedValue, validateFileUpload } from "@/lib/utils";
import { sanitizeInput } from "@/lib/security";
import { rateLimit } from "@/lib/ratelimit";
import { errorApiResponse } from "@/lib/server-actions/api";
import { getTrustedClientIp } from "@/lib/request-ip";
import { verifyRegisterChallenge } from "@/lib/register-challenge";
import { logSecurityEvent } from "@/lib/security-audit-log";
import { isSafeIdentityUploadFilename } from "@/lib/identity-upload-filename";
import { USER_IDENTITY_UPLOAD_DIR } from "@/lib/user-upload-path";
import { hash } from "argon2";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // IP: gunakan getTrustedClientIp; set TRUST_FORWARD_HEADERS=true hanya di belakang proxy tepercaya.
    const ip = getTrustedClientIp(request);
    if (rateLimit(ip, 3, 60000)) {
      logSecurityEvent({
        action: "register",
        outcome: "rate_limited",
        ip,
        userAgent: request.headers.get("user-agent"),
        endpoint: "/api/auth/register",
      });
      return NextResponse.json("Too many requests, please try again later", { status: 429 });
    }

    const uploadDir = USER_IDENTITY_UPLOAD_DIR;

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const formData = await request.formData();

    const challengeToken = String(formData.get("challenge") ?? "").trim();
    if (!verifyRegisterChallenge(challengeToken)) {
      logSecurityEvent({
        action: "register",
        outcome: "denied",
        ip,
        userAgent: request.headers.get("user-agent"),
        endpoint: "/api/auth/register",
        reason: "invalid_challenge",
      });
      return NextResponse.json(
        { error: "Sesi registrasi kedaluwarsa. Muat ulang halaman." },
        { status: 400 }
      );
    }

    // Honeypot anti-bot: field tersembunyi harus kosong
    const honeypot = String(formData.get("website") ?? "").trim();
    if (honeypot.length > 0) {
      logSecurityEvent({
        action: "register",
        outcome: "denied",
        ip,
        userAgent: request.headers.get("user-agent"),
        endpoint: "/api/auth/register",
        reason: "honeypot",
      });
      return NextResponse.json(
        { data: null, message: "Registrasi berhasil lanjut hubungi administrator" },
        { status: 200 }
      );
    }

    const nama = formData.get("nama");
    const fields: UserRegister = {} as UserRegister;
    const files: { file_npwp?: string; file_identitas?: string } = {};
    // Tunda penulisan ke disk sampai SEMUA validasi + pembuatan user sukses,
    // agar tidak meninggalkan file yatim saat validasi gagal (storage DoS).
    const pendingWrites: { filePath: string; bytes: Uint8Array }[] = [];

    const entries = Array.from(formData.entries());

    await Promise.all(
      entries.map(async ([key, value]) => {
        if (value instanceof File) {
          const file = value;
          const fileBuffer = await file.arrayBuffer();
          const validation = validateFileUpload(file, {}, fileBuffer);
          if (validation.error) {
            throw new Error(validation.error);
          }

          // Sanitasi Nama File
          const safeName = (nama as string).replace(/[^a-zA-Z0-9-_]/g, "_");
          const extension = file.name.split(".").pop()?.toLowerCase();
          const fileName = `${safeName}-${
            key === "file_npwp" ? "npwp" : "nik"
          }.${extension}`;
          if (!isSafeIdentityUploadFilename(fileName)) {
            throw new Error("Nama file tidak valid");
          }
          const filePath = path.join(uploadDir, fileName);
          pendingWrites.push({ filePath, bytes: new Uint8Array(fileBuffer) });
          setNestedValue(files, key, fileName);
        } else {
          if (value === "true") {
            setNestedValue(fields, key, true);
          } else if (value === "false") {
            setNestedValue(fields, key, false);
          } else {
            setNestedValue(fields, key, sanitizeInput(value.toString()));
          }
        }
      })
    );
    const parsed = UserRegisterSchema.safeParse(fields);
    if (!parsed.success) {
      logger.error({
        msg: "Registration validation failed",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
        })),
      });
      return NextResponse.json("Data is not valid", { status: 400 });
    }

    const username = fields.user;
    if (typeof username !== "string" || !/^[a-z0-9_-]+$/.test(username)) {
      return NextResponse.json("Invalid username", { status: 400 });
    }
    const existingUser = await prisma.user.findFirst({
      where: { user: username },
    });
    if (existingUser) {
      return NextResponse.json("Username is taken", { status: 400 });
    }

    const password = fields.password;
    if (typeof password !== "string" || password.length < 8 || password.length > 255) {
      return NextResponse.json("Invalid password (min 8 characters)", { status: 400 });
    }

    const passwordHash = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    // Semua validasi lolos: tulis file ke disk sekarang. Jika gagal, bersihkan.
    const writtenPaths: string[] = [];
    try {
      for (const w of pendingWrites) {
        fs.writeFileSync(w.filePath, w.bytes);
        writtenPaths.push(w.filePath);
      }
    } catch (writeErr) {
      for (const p of writtenPaths) {
        try {
          fs.unlinkSync(p);
        } catch {}
      }
      throw writeErr;
    }

    let post;
    try {
      post = await prisma.user.create({
        data: {
          nama: fields.nama as string,
          user: username,
          password: passwordHash,
          role: "Pending", // SECURITY: Default to low-privilege role. Superadmin upgrades after verification.
          nomor: fields.nomor,
          alamat: fields.alamat,
          no_identitas: fields.no_identitas,
          file_identitas: files.file_identitas,
          npwp: fields.npwp,
          file_npwp: files.file_npwp,
          verified: false,
        },
      });
    } catch (createErr) {
      // Rollback file yang sudah ditulis bila pembuatan user gagal.
      for (const p of writtenPaths) {
        try {
          fs.unlinkSync(p);
        } catch {}
      }
      throw createErr;
    }

    // Hapus password dari response agar tidak bocor ke client
    const { password: _, ...userWithoutPassword } = post;

    return NextResponse.json({
      data: userWithoutPassword,
      message: "Registrasi berhasil lanjut hubungi administrator",
    });
  } catch (err) {
    return errorApiResponse(err);
  }
}
