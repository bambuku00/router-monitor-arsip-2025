import { validateRequest } from "@/lib/auth";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { errorApiResponse } from "@/lib/server-actions/api";
import { Client, ClientSchema } from "@/lib/user-types";
import { setNestedValue, validateFileUpload } from "@/lib/utils";
import { sanitizeInput } from "@/lib/security"; // Adjusted imports based on check
import { canAccessManagedUser } from "@/lib/rbac";
import { hash } from "argon2";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { isSafeIdentityUploadFilename } from "@/lib/identity-upload-filename";
import { USER_IDENTITY_UPLOAD_DIR } from "@/lib/user-upload-path";
import { Perorang, Prisma } from "@prisma/client";

export async function PUT(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { user, session } = await validateRequest();
    if (!session) return new Response(null, { status: 401 });

    const params = await segmentData.params;
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client)
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    // Authorize by client owner (userId), not client id — prevents cross-tenant access.
    if (!(await canAccessManagedUser(user, client.userId)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

          // Only process if file has content
          if (file.size > 0) {
            const fileBuffer = await file.arrayBuffer();
            const validation = validateFileUpload(file, {}, fileBuffer);
            if (validation.error) {
              throw new Error(validation.error);
            }

            // Sanitasi Nama File
            const safeName = ((nama as string) || "user").replace(/[^a-zA-Z0-9-_]/g, "_");
            const extension = file.name.split(".").pop()?.toLowerCase();
            const fileName = `${safeName}-${
                key.includes("npwp") ? "npwp" : "nik"
            }-${Date.now()}.${extension}`; // Added timestamp to avoid collision on update
            if (!isSafeIdentityUploadFilename(fileName)) {
              throw new Error("Nama file tidak valid");
            }
            const filePath = path.join(uploadDir, fileName);
            fs.writeFileSync(filePath, new Uint8Array(fileBuffer));
            
            // Map key to file field name
            if (key.includes("npwp")) files.file_npwp = fileName;
            else if (key.includes("identitas")) files.file_identitas = fileName;
          }
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
      logger.error({ msg: "user client validation failed", error: parsed.error });
      return NextResponse.json({ error: "Data is not valid", details: parsed.error }, { status: 400 });
    }
    const validatedFields = parsed.data;

    const username = validatedFields.user;
    if (typeof username === "string" && username.length > 0) {
        if (!/^[a-z0-9_-]+$/.test(username)) {
            return NextResponse.json({ error: "Invalid username" }, { status: 400 });
        }
        const existingUser = await prisma.user.findFirst({
            where: { user: username, NOT: { id: client.userId } },
        });
        if (existingUser) {
            return NextResponse.json({ error: "Username is taken" }, { status: 400 });
        }
    }

    const password = validatedFields.password;
    let passwordHash;
    if (password && typeof password === "string" && password.length > 0) {
       if (password.length < 8 || password.length > 255) {
         return NextResponse.json({ error: "Invalid password (min 8 characters)" }, { status: 400 });
       }
       passwordHash = await hash(password, {
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
        nama: validatedFields.nama,
        user: validatedFields.user,
        alamat: validatedFields.alamat,
        nomor: validatedFields.nomor,
        identitas: validatedFields.identitas.jenis,
        no_identitas: validatedFields.identitas.nomor,
        npwp: validatedFields.npwp.nomor,
        ...(passwordHash ? { password: passwordHash } : {}),
        ...(files.file_identitas ? { file_identitas: files.file_identitas } : {}),
        ...(files.file_npwp ? { file_npwp: files.file_npwp } : {}),
    };

    const ownerUserId = client.userId;

    const resp = await prisma.user.update({
      where: {
        id: ownerUserId,
      },
      data: {
        ...(updateData as Prisma.UserUpdateInput),
        client: {
          update: {
            tgl: validatedFields.tgl,
            nama: validatedFields.nama,
            institusi: validatedFields.institusi,
            kota: validatedFields.kota,
            pos: validatedFields.pos,
            telepon: validatedFields.telepon,
            perorangan: {
              deleteMany: {
                  clientId: { not: undefined } // Delete all for this client
              },
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

    // Remove password from response
    const { password: _, ...userWithoutPassword } = resp;

    return NextResponse.json({
      data: userWithoutPassword,
      message: "Data client berhasil diperbarui",
    });
  } catch (err) {
    const error = err as Error;
    return errorApiResponse(error);
  }
}
