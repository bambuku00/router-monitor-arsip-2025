/**
 * zod-prisma-types emits ZodEffects that fail strict assignment to z.ZodType<Prisma.*>.
 * Must run after every `prisma generate` (and before `next build`).
 */
const fs = require("fs");
const path = require("path");

const file = path.join(
  __dirname,
  "..",
  "prisma",
  "generated",
  "zod",
  "index.ts"
);

if (!fs.existsSync(file)) {
  console.error("fix-prisma-zod-json-null: missing", file);
  process.exit(1);
}

const patchedInput = `export const NullableJsonNullValueInputSchema = z
  .enum(['DbNull', 'JsonNull'])
  .transform((value) =>
    value === 'JsonNull' ? Prisma.JsonNull : value === 'DbNull' ? Prisma.DbNull : value,
  ) as unknown as z.ZodType<Prisma.NullableJsonNullValueInput>;`;

const patchedFilter = `export const JsonNullValueFilterSchema = z
  .enum(['DbNull', 'JsonNull', 'AnyNull'])
  .transform((value) =>
    value === 'JsonNull'
      ? Prisma.JsonNull
      : value === 'DbNull'
        ? Prisma.DbNull
        : value === 'AnyNull'
          ? Prisma.AnyNull
          : value,
  ) as unknown as z.ZodType<Prisma.JsonNullValueFilter>;`;

let content = fs.readFileSync(file, "utf8");
const before = content;

// Exact single-line forms emitted by zod-prisma-types (most common on VPS).
const singleLineInput =
  /export const NullableJsonNullValueInputSchema:\s*z\.ZodType<Prisma\.NullableJsonNullValueInput>\s*=\s*z\.enum\(\['DbNull','JsonNull',\]\)\.transform\(\(value\)\s*=>\s*value\s*===\s*'JsonNull'\s*\?\s*Prisma\.JsonNull\s*:\s*value\s*===\s*'DbNull'\s*\?\s*Prisma\.DbNull\s*:\s*value\);/;

const singleLineFilter =
  /export const JsonNullValueFilterSchema:\s*z\.ZodType<Prisma\.JsonNullValueFilter>\s*=\s*z\.enum\(\['DbNull','JsonNull','AnyNull',\]\)\.transform\(\(value\)\s*=>\s*value\s*===\s*'JsonNull'\s*\?\s*Prisma\.JsonNull\s*:\s*value\s*===\s*'DbNull'\s*\?\s*Prisma\.DbNull\s*:\s*value\s*===\s*'AnyNull'\s*\?\s*Prisma\.AnyNull\s*:\s*value\);/;

content = content.replace(singleLineInput, patchedInput);
content = content.replace(singleLineFilter, patchedFilter);

// Multi-line / already-partial forms: replace whole export until next export.
const inputBlock =
  /export const NullableJsonNullValueInputSchema[\s\S]*?;(?=\s*\n\s*export const)/;
const filterBlock =
  /export const JsonNullValueFilterSchema[\s\S]*?;(?=\s*\n\s*export const)/;

if (
  content.includes("NullableJsonNullValueInputSchema") &&
  !content.includes(
    "as unknown as z.ZodType<Prisma.NullableJsonNullValueInput>"
  )
) {
  if (!inputBlock.test(content)) {
    console.error(
      "fix-prisma-zod-json-null: could not match NullableJsonNullValueInputSchema"
    );
    process.exit(1);
  }
  content = content.replace(inputBlock, patchedInput);
}

if (
  content.includes("JsonNullValueFilterSchema") &&
  !content.includes("as unknown as z.ZodType<Prisma.JsonNullValueFilter>")
) {
  if (!filterBlock.test(content)) {
    console.error(
      "fix-prisma-zod-json-null: could not match JsonNullValueFilterSchema"
    );
    process.exit(1);
  }
  content = content.replace(filterBlock, patchedFilter);
}

// Belt-and-suspenders: skip typechecking this generated file entirely.
if (!content.startsWith("// @ts-nocheck")) {
  content = `// @ts-nocheck\n${content}`;
}

if (content === before) {
  // Still verify patched markers exist.
  if (
    !content.includes(
      "as unknown as z.ZodType<Prisma.NullableJsonNullValueInput>"
    ) ||
    !content.includes("as unknown as z.ZodType<Prisma.JsonNullValueFilter>")
  ) {
    console.error(
      "fix-prisma-zod-json-null: file unchanged and still unpatched"
    );
    process.exit(1);
  }
  console.log("fix-prisma-zod-json-null: already patched");
  process.exit(0);
}

fs.writeFileSync(file, content);
console.log(
  "fix-prisma-zod-json-null: patched NullableJsonNullValueInputSchema + JsonNullValueFilterSchema (+ @ts-nocheck)"
);
