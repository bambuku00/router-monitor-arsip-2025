import { createHmac, timingSafeEqual } from "node:crypto";
import prisma from "@/lib/prisma";
import {
  decryptRouterPassword,
  encryptRouterPassword,
} from "@/lib/router-password-crypto";

export type TripayChannel = {
  code: string;
  name: string;
  group: string;
};

export function encryptTripaySecret(value: string): string {
  return encryptRouterPassword(value);
}

export function decryptTripaySecret(stored: string): string {
  return decryptRouterPassword(stored);
}

export function tripayExpiredSeconds(method: string): number {
  const code = method.toUpperCase();
  if (
    code === "QRIS" ||
    code === "QRIS_SHOPEEPAY" ||
    code === "SHOPEEPAY" ||
    code === "DANA"
  ) {
    return 60 * 60;
  }
  return 24 * 60 * 60;
}

export function tripayApiBase(sandbox: boolean): string {
  return sandbox ? "https://tripay.co.id/api-sandbox" : "https://tripay.co.id/api";
}

export function tripayCreateSignature(
  merchantCode: string,
  merchantRef: string,
  amount: number,
  privateKey: string
): string {
  return createHmac("sha256", privateKey)
    .update(`${merchantCode}${merchantRef}${amount}`)
    .digest("hex");
}

export function tripayCallbackSignature(rawBody: string, privateKey: string): string {
  return createHmac("sha256", privateKey).update(rawBody).digest("hex");
}

export function tripaySignaturesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function tripayCallbackAmountMatches(
  body: Record<string, unknown>,
  expected: number
): boolean {
  const direct = [body.amount, body.total_amount, body.amount_received]
    .map((value) => Math.round(Number(value)))
    .filter((value) => Number.isFinite(value));
  if (direct.includes(expected)) return true;
  const total = Math.round(Number(body.total_amount));
  const fee = Math.round(Number(body.fee_customer));
  return Number.isFinite(total) && Number.isFinite(fee) && total - fee === expected;
}

function tripayMessage(payload: unknown): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = String((payload as { message?: unknown }).message ?? "").trim();
    if (message) return message.slice(0, 180);
  }
  return "Tripay menolak permintaan.";
}

async function tripayFetch(
  url: string,
  apiKey: string,
  init?: RequestInit
): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  const payload = (await res.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    data?: unknown;
  } | null;
  if (!res.ok || payload?.success === false) {
    throw new Error(tripayMessage(payload));
  }
  return payload?.data;
}

export async function listTripayChannels(opts: {
  sandbox: boolean;
  apiKey: string;
}): Promise<TripayChannel[]> {
  const data = await tripayFetch(
    `${tripayApiBase(opts.sandbox)}/merchant/payment-channel`,
    opts.apiKey
  );
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as {
      code?: unknown;
      name?: unknown;
      group?: unknown;
      active?: unknown;
    };
    const code = String(row.code ?? "").trim();
    if (!code || row.active === false) return [];
    return [
      {
        code,
        name: String(row.name ?? code),
        group: String(row.group ?? ""),
      },
    ];
  });
}

export async function createTripayTransaction(opts: {
  sandbox: boolean;
  apiKey: string;
  privateKey: string;
  merchantCode: string;
  merchantRef: string;
  amount: number;
  method: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  itemName: string;
  callbackUrl: string;
  returnUrl: string;
}): Promise<{ reference: string; checkoutUrl: string; status: string }> {
  const signature = tripayCreateSignature(
    opts.merchantCode,
    opts.merchantRef,
    opts.amount,
    opts.privateKey
  );
  const data = await tripayFetch(
    `${tripayApiBase(opts.sandbox)}/transaction/create`,
    opts.apiKey,
    {
      method: "POST",
      body: JSON.stringify({
        method: opts.method,
        merchant_ref: opts.merchantRef,
        amount: opts.amount,
        customer_name: opts.customerName.slice(0, 80),
        customer_email: opts.customerEmail,
        customer_phone: opts.customerPhone,
        order_items: [
          {
            sku: opts.merchantRef.slice(0, 32),
            name: opts.itemName.slice(0, 80),
            price: opts.amount,
            quantity: 1,
          },
        ],
        callback_url: opts.callbackUrl,
        return_url: opts.returnUrl,
        expired_time: Math.floor(Date.now() / 1000) + tripayExpiredSeconds(opts.method),
        signature,
      }),
    }
  );
  const row = data as {
    reference?: unknown;
    checkout_url?: unknown;
    status?: unknown;
  } | null;
  const checkoutUrl = String(row?.checkout_url ?? "");
  const reference = String(row?.reference ?? "");
  if (!checkoutUrl.startsWith("https://") || !reference) {
    throw new Error("Tripay tidak mengirim halaman pembayaran.");
  }
  return {
    reference,
    checkoutUrl,
    status: String(row?.status ?? "UNPAID").slice(0, 16),
  };
}

export async function loadActiveTripay(userId: number | null | undefined) {
  if (!userId) return null;
  const row = await prisma.tripayGateway.findUnique({ where: { userId } });
  if (!row?.enabled || !row.merchantCode || !row.apiKey || !row.privateKey) return null;
  return {
    sandbox: row.sandbox,
    merchantCode: row.merchantCode,
    apiKey: decryptTripaySecret(row.apiKey),
    privateKey: decryptTripaySecret(row.privateKey),
  };
}
