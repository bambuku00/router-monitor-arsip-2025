/**
 * Shared constants to avoid magic numbers across the app.
 */

export const TIME = {
  /** 1 minute in ms */
  ONE_MINUTE_MS: 60 * 1000,
  /** 1 day in ms */
  ONE_DAY_MS: 24 * 60 * 60 * 1000,
  /** 30 seconds in ms (e.g. request timeout) */
  REQUEST_TIMEOUT_MS: 30 * 1000,
  /** 5 minutes in ms (e.g. rate limit cleanup interval) */
  FIVE_MINUTES_MS: 60 * 1000 * 5,
  /** 7 days in seconds (cache revalidate) */
  SEVEN_DAYS_SEC: 60 * 60 * 24 * 7,
} as const;

export const RATE_LIMIT = {
  /** Max requests per IP per window */
  MAX_REQUESTS: 100,
  /** Window duration in ms (1 minute) */
  WINDOW_MS: TIME.ONE_MINUTE_MS,
} as const;

/** Billing / tagihan */
export const BILLING = {
  /** Grace period (hari) setelah tgl pemasangan sebelum tagihan pertama */
  BILLING_CYCLE_DAYS: 30,
  /** Tanggal jatuh tempo tagihan setiap bulan (1–28) */
  DUE_DAY_OF_MONTH: 20,
} as const;

/** File upload (client & API) */
export const FILE_UPLOAD = {
  /** Max size in bytes (default 5MB) */
  MAX_SIZE_BYTES: 5 * 1024 * 1024,
  /** Allowed extensions for identity/NPWP uploads */
  ALLOWED_EXTENSIONS: ["jpg", "jpeg", "png", "pdf"] as const,
  /** MIME types accepted per extension (defense in depth; also check magic bytes). */
  ALLOWED_MIME_BY_EXT: {
    jpg: ["image/jpeg"],
    jpeg: ["image/jpeg"],
    png: ["image/png"],
    pdf: ["application/pdf"],
  } as const,
} as const;
