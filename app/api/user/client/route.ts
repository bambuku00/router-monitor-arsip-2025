import { validateRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Client, ClientSchema } from "@/lib/user-types";
import { setNestedValue, validateFileUpload } from "@/lib/utils";
import { sanitizeInput } from "@/lib/security";
import { isSafeIdentityUploadFilename } from "@/lib/identity-upload-filename";
import { USER_IDENTITY_UPLOAD_DIR } from "@/lib/user-upload-path";
import { errorApiResponse } from "@/lib/server-actions/api";
import { Perorang } from "@prisma/client";
import { hash } from "argon2";
import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session) return new Response(null, { status: 401 });
    if (user.role !== "Superadmin")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const uploadDir = USER_IDENTITY_UPLOAD_DIR;

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const formData = await request.formData();
    const nama = formData.get("nama");
    const fields: Client = {} as Client;
    const files: { file_npwp?: string; file_identitas?: string } = {};

    const entries = Array.from(formData.entries());

    await Promise.all(
      entries.map(async ([key, value]) => {
        if (value instanceof File) {
          const file = value;
          const fileBuffer = await file.arrayBuffer();
          const validation = validateFileUpload(file, {}, fileBuffer);
          if (validation.error) throw new Error(validation.error);

          const extension = file.name.split(".").pop()?.toLowerCase();
          const safeName = (nama as string).replace(/[^a-zA-Z0-9-_]/g, "_");
          const fileName = `${safeName}-${
            key === "npwp.file_npwp" ? "npwp" : "nik"
          }.${extension}`;
          if (!isSafeIdentityUploadFilename(fileName)) {
            throw new Error("Nama file tidak valid");
          }
          const filePath = path.join(uploadDir, fileName);
          fs.writeFileSync(filePath, new Uint8Array(fileBuffer));
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
    const parsed = ClientSchema.safeParse(fields);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data is not valid" }, { status: 400 });
    }
    const validatedFields = parsed.data;

    const username = validatedFields.user;
    if (typeof username !== "string" || !/^[a-z0-9_-]+$/.test(username)) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }
    const existingUser = await prisma.user.findFirst({
      where: { user: username },
    });
    if (existingUser) {
      return NextResponse.json({ error: "Username is taken" }, { status: 400 });
    }

    const password = validatedFields.password;
    if (typeof password !== "string" || password.length < 8 || password.length > 255) {
      return NextResponse.json({ error: "Invalid password (min 8 characters)" }, { status: 400 });
    }

    const passwordHash = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const post = await prisma.user.create({
      data: {
        nama: validatedFields.nama,
        user: username,
        password: passwordHash,
        role: "Client",
        alamat: validatedFields.alamat,
        nomor: validatedFields.nomor,
        identitas: validatedFields.identitas.jenis,
        no_identitas: validatedFields.identitas.nomor,
        npwp: validatedFields.npwp.nomor,
        file_identitas: files.file_identitas,
        file_npwp: files.file_npwp,
        client: {
          create: {
            tgl: validatedFields.tgl,
            nama: validatedFields.nama,
            institusi: validatedFields.institusi,
            kota: validatedFields.kota,
            pos: validatedFields.pos,
            telepon: validatedFields.telepon,
            perorangan: {
              createMany: {
                data: [
                  {
                    orang: "PJ",
                    nama: validatedFields.pj.nama,
                    nomor: validatedFields.pj.nomor,
                    email: validatedFields.pj.email,
                  },
                  ...(validatedFields.teknisi.sama
                    ? []
                    : [
                        {
                          orang: "Teknisi" as Perorang,
                          nama: validatedFields.teknisi.nama as string,
                          nomor: validatedFields.teknisi.nomor as string,
                          email: validatedFields.teknisi.email as string,
                        },
                      ]),
                  ...(validatedFields.keuangan.sama
                    ? []
                    : [
                        {
                          orang: "Keuangan" as Perorang,
                          nama: validatedFields.keuangan.nama as string,
                          nomor: validatedFields.keuangan.nomor as string,
                          email: validatedFields.keuangan.email as string,
                        },
                      ]),
                ],
              },
            },
          },
        },
      },
    });

    // Hapus password dari response agar tidak bocor ke client
    const { password: _, ...userWithoutPassword } = post;

    return NextResponse.json({
      data: userWithoutPassword,
      message: "Data telah berhasil disimpan",
    });
  } catch (err) {
    return errorApiResponse(err);
  }
}
