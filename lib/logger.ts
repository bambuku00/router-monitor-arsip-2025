import pino, { type Logger } from "pino";

// Disable pino-pretty transport to avoid ERR_WORKER_PATH issues in Next.js Turbopack/Dev environments.
// For pretty logs, pipe the output: `npm run dev | pino-pretty`

const globalForLogger = globalThis as typeof globalThis & {
  pinoLogger?: Logger;
};

function createLogger(): Logger {
  return pino({
    level: process.env.LOG_LEVEL || "info",
  });
}

export const logger: Logger = globalForLogger.pinoLogger ?? createLogger();
globalForLogger.pinoLogger = logger;
