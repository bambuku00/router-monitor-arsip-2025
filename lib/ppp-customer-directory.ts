export type PppCustomerDirectoryRow = {
  nama: string;
  nomor: string;
  alamat: string;
};

const FIELD_MAX = 191;

export function normalizeCustomerPhone(raw: string): string {
  let digits = raw.trim().replace(/\D/g, "");
  if (!digits) return "-";
  if (digits.startsWith("008")) digits = digits.slice(1);
  if (digits.startsWith("62")) digits = `0${digits.slice(2)}`;
  return digits.slice(0, FIELD_MAX);
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const char = src[i];
    if (quoted) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }
  return rows;
}

function clip(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, FIELD_MAX);
}

export function buildPppCustomerDirectory(
  csv: string
): Map<string, PppCustomerDirectoryRow> {
  const table = parseCsv(csv);
  const header = (table[0] ?? []).map((cell) => cell.trim().toLowerCase());
  const namaIndex = header.indexOf("pelanggan");
  const userIndex = header.indexOf("username");
  const phoneIndex = header.indexOf("no_wa");
  const addressIndex = header.indexOf("alamat");
  const directory = new Map<string, PppCustomerDirectoryRow>();
  if (namaIndex < 0 || userIndex < 0 || phoneIndex < 0 || addressIndex < 0) {
    return directory;
  }

  for (const cells of table.slice(1)) {
    const username = (cells[userIndex] ?? "").trim().toLowerCase();
    const nama = clip(cells[namaIndex] ?? "");
    if (!username || !nama) continue;
    if (directory.has(username)) continue;
    directory.set(username, {
      nama,
      nomor: normalizeCustomerPhone(cells[phoneIndex] ?? ""),
      alamat: clip(cells[addressIndex] ?? "") || "-",
    });
  }
  return directory;
}

export function csvHasCustomerDirectoryHeader(csv: string): boolean {
  const header = (parseCsv(csv)[0] ?? []).map((cell) => cell.trim().toLowerCase());
  return (
    header.includes("pelanggan") &&
    header.includes("username") &&
    header.includes("no_wa") &&
    header.includes("alamat")
  );
}
