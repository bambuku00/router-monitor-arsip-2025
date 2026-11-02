import { z } from "zod";

/** Body create/update paket — nominalPembayaran adalah source of truth dari client. */
export const PaketWriteBodySchema = z.object({
  id: z.number().int().positive().optional(),
  nama: z.string().min(1),
  kapasitas: z.number(),
  userId: z.number().int().positive().optional(),
  nominalPembayaran: z.number().int().min(0),
});

export type PaketWriteBody = z.infer<typeof PaketWriteBodySchema>;
