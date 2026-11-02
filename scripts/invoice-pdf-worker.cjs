/**
 * Worker terpisah agar Puppeteer tidak di-bundle Next.js.
 * Usage: node scripts/invoice-pdf-worker.cjs <htmlPath> <pdfPath>
 */
const puppeteer = require("puppeteer");
const fs = require("node:fs");
const path = require("node:path");

/** Tinggi & lebar kertas A4 @ 96dpi (mm → px). */
const A4_WIDTH_PX = Math.round((210 * 96) / 25.4);
const A4_HEIGHT_PX = Math.round((297 * 96) / 25.4);

function resolveChromeExecutable() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const projectCache = path.join(
    process.cwd(),
    ".cache",
    "puppeteer",
    "chrome"
  );
  if (fs.existsSync(projectCache)) {
    const matches = fs
      .readdirSync(projectCache, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse();
    for (const dir of matches) {
      const win = path.join(
        projectCache,
        dir,
        "chrome-win64",
        "chrome.exe"
      );
      const linux = path.join(
        projectCache,
        dir,
        "chrome-linux64",
        "chrome"
      );
      if (fs.existsSync(win)) return win;
      if (fs.existsSync(linux)) return linux;
    }
  }

  return undefined;
}

async function main() {
  const htmlPath = process.argv[2];
  const pdfPath = process.argv[3];
  if (!htmlPath || !pdfPath) {
    console.error("Usage: node invoice-pdf-worker.cjs <htmlPath> <pdfPath>");
    process.exit(1);
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  // Sandbox Chromium aktif kecuali PUPPETEER_NO_SANDBOX=1 (container tanpa user namespace).
  const noSandbox = process.env.PUPPETEER_NO_SANDBOX === "1";
  const executablePath = resolveChromeExecutable();
  if (!executablePath) {
    throw new Error(
      "Chrome untuk Puppeteer tidak ditemukan. Jalankan: npm run puppeteer:install"
    );
  }
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      ...(noSandbox
        ? ["--no-sandbox", "--disable-setuid-sandbox"]
        : []),
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX,
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: "load", timeout: 30000 });
    await page.emulateMediaType("print");

    const layout = await page.evaluate(() => {
      const body = document.body;
      return {
        invoicePageCount: document.querySelectorAll(".invoice-page").length,
        contentHeight: Math.max(
          body.scrollHeight,
          body.getBoundingClientRect().height
        ),
      };
    });

    // Gabungan banyak invoice (.invoice-page) — biarkan page-break CSS, jangan shrink global.
    let scale = 1;
    const isCombinedDocument = layout.invoicePageCount > 1;
    if (
      !isCombinedDocument &&
      layout.contentHeight > A4_HEIGHT_PX * 1.015
    ) {
      const computed = (A4_HEIGHT_PX / layout.contentHeight) * 0.992;
      if (computed >= 0.1) {
        scale = Math.min(1, computed);
      }
    }
    scale = Math.max(0.1, Math.min(2, scale));

    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      scale,
    });
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
