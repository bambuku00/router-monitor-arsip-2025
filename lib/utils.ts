import clsx, { ClassValue } from "clsx";
import { Coordinate } from "ol/coordinate";
import { twMerge } from "tailwind-merge";
import { FILE_UPLOAD } from "@/lib/constants";

export type ArrayElementType<T> = T extends (infer U)[] ? U : never;
export type AllStrings<T> = {
  [K in keyof T]: string;
};

export const coorMalangArr = [
  112.63263553088431, -7.966545787219958,
] as Coordinate;

export const coorJakartaArr = [106.8229, -6.1944] as Coordinate;

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
export const formatBytes = (bytes: string | number, decimals = 2) => {
  const parsedBytes = typeof bytes === "string" ? parseFloat(bytes) : bytes;
  if (!+parsedBytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;

  const i = Math.floor(Math.log(parsedBytes) / Math.log(k));

  return `${parseFloat((parsedBytes / Math.pow(k, i)).toFixed(dm))} ${
    sizes[i]
  }`;
};

export const formatKiloBytes = (kilobytes: string | number, decimals = 2) => {
  const parsedKilobytes =
    typeof kilobytes === "string" ? parseFloat(kilobytes) : kilobytes;
  if (!+parsedKilobytes) return "0 Bytes";
  const bytes = parsedKilobytes * 1024;
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export function setNestedValue(obj: any, path: string, value: any) {
  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
}

// ========== API Utility Functions ==========

/**
 * Validates username format
 * @param username - Username to validate
 * @returns true if valid, false otherwise
 */
export function isValidUsername(username: unknown): username is string {
  return (
    typeof username === "string" &&
    username.length >= 3 &&
    username.length <= 31 &&
    /^[a-z0-9_-]+$/.test(username)
  );
}

/**
 * Validates password
 * @param password - Password to validate
 * @param minLength - Minimum length (default: 8)
 * @param maxLength - Maximum length (default: 255)
 * @returns true if valid, false otherwise
 */
export function isValidPassword(
  password: unknown,
  minLength = 8,
  maxLength = 255
): password is string {
  return (
    typeof password === "string" &&
    password.length >= minLength &&
    password.length <= maxLength
  );
}

export const formatCurrency = (value: number) => {
  if (isNaN(value)) return "Rp0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};

/**
 * Validates a file for upload (size, extension, optional MIME + magic bytes).
 * @param fileBytes - When provided, first bytes are checked so extension matches real content.
 * @returns { error?: string } - Error message if invalid
 */
export function validateFileUpload(
  file: File,
  options: {
    maxSize?: number;
    allowedExtensions?: readonly string[];
  } = {},
  fileBytes?: ArrayBuffer
) {
  const {
    maxSize = FILE_UPLOAD.MAX_SIZE_BYTES,
    allowedExtensions = [...FILE_UPLOAD.ALLOWED_EXTENSIONS],
  } = options;

  if (file.size > maxSize) {
    return {
      error: `Ukuran file terlalu besar (Maks ${formatBytes(maxSize)})`,
    };
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !allowedExtensions.includes(extension)) {
    return {
      error: `Format file tidak didukung (Gunakan ${allowedExtensions
        .join(", ")
        .toUpperCase()})`,
    };
  }

  const mime = file.type?.trim().toLowerCase();
  if (mime) {
    const okMime =
      FILE_UPLOAD.ALLOWED_MIME_BY_EXT[
        extension as keyof typeof FILE_UPLOAD.ALLOWED_MIME_BY_EXT
      ];
    if (okMime && !(okMime as readonly string[]).includes(mime)) {
      return { error: "Tipe MIME file tidak sesuai isi yang diizinkan" };
    }
  }

  if (fileBytes && fileBytes.byteLength > 0) {
    const head = new Uint8Array(fileBytes.slice(0, 16));
    if (!magicBytesMatch(extension, head)) {
      return { error: "Isi file tidak sesuai format (JPG, PNG, atau PDF)" };
    }
  }

  return {};
}

function magicBytesMatch(extension: string, head: Uint8Array): boolean {
  if (head.length < 4) return false;
  if (extension === "jpg" || extension === "jpeg") {
    return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  }
  if (extension === "png") {
    return (
      head[0] === 0x89 &&
      head[1] === 0x50 &&
      head[2] === 0x4e &&
      head[3] === 0x47
    );
  }
  if (extension === "pdf") {
    return (
      head[0] === 0x25 &&
      head[1] === 0x50 &&
      head[2] === 0x44 &&
      head[3] === 0x46
    );
  }
  return false;
}

export function createErrorResponse(error: unknown, status: number = 500) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    success: false,
    message,
    status,
  };
}

/**
 * Validates pagination parameters
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @returns Object with validated page, limit, and skip
 */
export function validatePagination(page: unknown, limit: unknown) {
  let p = Number(page);
  let l = Number(limit);

  if (isNaN(p) || p < 1) p = 1;
  if (isNaN(l) || l < 1) l = 10;

  return { page: p, limit: l, skip: (p - 1) * l };
}

/**
 * Validates date string is in strict YYYY-MM-DD format
 * Prevents timezone bugs from malformed dates like "2025-1-1"
 * @param dateStr - Date string to validate
 * @returns true if valid YYYY-MM-DD format
 */
export function isValidDateFormat(dateStr: string): boolean {
  // Must match YYYY-MM-DD exactly (with zero-padding)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;
  
  // Parse components
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Validate ranges
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  
  // Check if date is actually valid (e.g., not Feb 31)
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return false;
  }
  
  return true;
}

/**
 * Validates and normalizes date string to YYYY-MM-DD
 * @param dateStr - Date string to normalize
 * @returns Normalized date string or null if invalid
 */
export function normalizeDateString(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Already in correct format
  if (isValidDateFormat(dateStr)) return dateStr;
  
  // Try to parse and reformat
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Bersihkan string untuk aman di serialisasi RSC/Flight (karakter kontrol, surrogate utuh).
 * Mengurangi error JSON.parse "Bad escaped character" dari payload yang rusak.
 */
export function flightSafeText(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\uD800-\uDFFF]/g, "\uFFFD");
}
