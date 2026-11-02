/**
 * Cache browser Puppeteer di dalam project agar path konsisten
 * (dev Windows + deploy VPS) dan tidak bergantung pada sandbox/temp.
 */
const { join } = require("node:path");

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
