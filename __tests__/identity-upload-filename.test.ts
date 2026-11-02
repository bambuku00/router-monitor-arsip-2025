import { describe, it, expect } from "vitest";
import { isSafeIdentityUploadFilename } from "@/lib/identity-upload-filename";

describe("isSafeIdentityUploadFilename", () => {
  it("accepts expected upload names", () => {
    expect(isSafeIdentityUploadFilename("Budi-nik.pdf")).toBe(true);
    expect(isSafeIdentityUploadFilename("x-npwp-1716123456789.jpeg")).toBe(true);
  });

  it("rejects path traversal and odd extensions", () => {
    expect(isSafeIdentityUploadFilename("../etc/passwd")).toBe(false);
    expect(isSafeIdentityUploadFilename("a.php")).toBe(false);
    expect(isSafeIdentityUploadFilename("a.pdfx")).toBe(false);
    expect(isSafeIdentityUploadFilename(".hidden.pdf")).toBe(false);
    expect(isSafeIdentityUploadFilename("a/slash.pdf")).toBe(false);
  });
});
