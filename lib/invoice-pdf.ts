import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const WORKER = path.join(process.cwd(), "scripts", "invoice-pdf-worker.cjs");

function runPdfWorker(htmlPath: string, pdfPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [WORKER, htmlPath, pdfPath], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            stderr.trim() || `PDF worker exited with code ${String(code)}`
          )
        );
    });
  });
}

export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  if (!fs.existsSync(WORKER)) {
    throw new Error(`PDF worker tidak ditemukan: ${WORKER}`);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "router-inv-pdf-"));
  const htmlPath = path.join(tmpDir, "invoice.html");
  const pdfPath = path.join(tmpDir, "invoice.pdf");

  try {
    fs.writeFileSync(htmlPath, html, "utf8");
    await runPdfWorker(htmlPath, pdfPath);

    if (!fs.existsSync(pdfPath)) {
      throw new Error("PDF worker tidak menghasilkan file");
    }

    return fs.readFileSync(pdfPath);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
