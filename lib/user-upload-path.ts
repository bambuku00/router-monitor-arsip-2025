import path from "node:path";

/** Upload identitas/NPWP di luar `public/` agar tidak dilayani sebagai static mentah. */
export const USER_IDENTITY_UPLOAD_DIR = path.join(
  process.cwd(),
  "uploads",
  "identity"
);
