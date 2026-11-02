"use server";

import { validateRequest } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";

const textMessage = `Selamat datang...`;

/**
 * Kirim WA selamat datang setelah registrasi / create user.
 * - Staff (Admin/Superadmin): butuh session.
 * - Publik (belum login): rate-limited ketat per nomor.
 * Device ID dari env WOOWA_DEVICE_ID (jangan hardcode).
 */
export default async function sendRegister(number: number) {
  try {
    if (!Number.isFinite(number) || number <= 0) {
      return { success: false, error: "Nomor tidak valid" };
    }

    const deviceId = process.env.WOOWA_DEVICE_ID?.trim();
    if (!deviceId) {
      logger.warn({ msg: "sendRegister skipped: WOOWA_DEVICE_ID unset" });
      return { success: false, error: "WA belum dikonfigurasi" };
    }

    const { user, session } = await validateRequest();
    if (session && user) {
      if (user.role !== "Superadmin" && user.role !== "Admin") {
        return { success: false, error: "Tidak diizinkan" };
      }
    } else {
      const key = `wa-register:${number}`;
      if (rateLimit(key, 2, 60_000)) {
        return { success: false, error: "Terlalu banyak permintaan" };
      }
    }

    const resp = await fetch(`https://crm.woo-wa.com/send/message-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        number,
        message: textMessage,
      }),
    });
    const json = await resp.json();
    return json;
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "sendRegister error", error: error.message });
    return { success: false, error: error.message };
  }
}
