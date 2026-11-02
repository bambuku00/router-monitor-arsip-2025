import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const validateRequest = vi.fn();
const getPembayaranInScope = vi.fn();
const buildBulkInvoicePdf = vi.fn();

vi.mock("@/lib/auth", () => ({
  validateRequest: (...args: unknown[]) => validateRequest(...args),
}));

vi.mock("@/lib/authz", () => ({
  getPembayaranInScope: (...args: unknown[]) => getPembayaranInScope(...args),
}));

vi.mock("@/lib/invoice-bulk-pdf", () => ({
  buildBulkInvoicePdf: (...args: unknown[]) => buildBulkInvoicePdf(...args),
}));

import { GET } from "@/app/api/pembayaran/invoice/[id]/pdf/route";

beforeEach(() => {
  validateRequest.mockReset();
  getPembayaranInScope.mockReset();
  buildBulkInvoicePdf.mockReset();
});

describe("GET /api/pembayaran/invoice/[id]/pdf authorization", () => {
  it("returns 403 when pembayaran is outside user scope", async () => {
    validateRequest.mockResolvedValue({
      user: {
        id: 5,
        role: "Teknisi",
        parentId: 10,
        staffMenuKeys: ["pembayaran"],
      },
      session: { id: "s1" },
    });
    getPembayaranInScope.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/pembayaran/invoice/999/pdf");
    const res = await GET(req, {
      params: Promise.resolve({ id: "999" }),
    });

    expect(res.status).toBe(403);
    expect(buildBulkInvoicePdf).not.toHaveBeenCalled();
  });

  it("returns 403 when user lacks pembayaran menu permission", async () => {
    validateRequest.mockResolvedValue({
      user: {
        id: 5,
        role: "Teknisi",
        parentId: 10,
        staffMenuKeys: ["routers"],
      },
      session: { id: "s1" },
    });

    const req = new NextRequest("http://localhost/api/pembayaran/invoice/1/pdf");
    const res = await GET(req, {
      params: Promise.resolve({ id: "1" }),
    });

    expect(res.status).toBe(403);
    expect(getPembayaranInScope).not.toHaveBeenCalled();
  });
});
