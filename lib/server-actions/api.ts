import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/utils";
import { logger } from "@/lib/logger";

/**
 * Creates a standardized error response for API routes
 * @param error - Error object or unknown error
 * @param status - HTTP status code (default: 500)
 * @returns NextResponse with error details
 */
export function errorApiResponse(error: unknown, status?: number) {
  const err = error instanceof Error ? error : new Error(String(error));
  
  // Determine status code if not provided
  let finalStatus = status || 500;
  if (!status) {
    const msg = err.message.toLowerCase();
    if (msg.includes("unauthorized") || msg.includes("authentication failed") || msg.includes("tidak diizinkan")) {
        finalStatus = 401;
    } else if (msg.includes("not found") || msg.includes("tidak ditemukan")) {
        finalStatus = 404;
    } else if (msg.includes("forbidden") || msg.includes("permission denied") || msg.includes("akses ditolak")) {
        finalStatus = 403;
    } else if (msg.includes("valid") || msg.includes("taken") || msg.includes("bad request") || msg.includes("exists") || msg.includes("ukuran file") || msg.includes("format file") || msg.includes("sudah digunakan") || msg.includes("gagal")) {
        finalStatus = 400;
    }
  }

  logger.error({
    msg: "API Error",
    error: err.message,
    stack: err.stack,
    status: finalStatus,
  });

  // SECURITY: jangan bocorkan detail internal (pesan Prisma/stack) ke client pada 5xx.
  // Detail sudah tercatat di log server. Untuk 4xx, pesan tetap ditampilkan (informatif & aman).
  if (finalStatus >= 500) {
    return NextResponse.json(
      createErrorResponse("Terjadi kesalahan pada server", finalStatus),
      { status: finalStatus }
    );
  }

  const errorResponse = createErrorResponse(error, finalStatus);
  return NextResponse.json(errorResponse, { status: finalStatus });
}
