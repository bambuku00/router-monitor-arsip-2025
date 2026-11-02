/**
 * Uji sederhana metode bagi hasil & pembagian persentase.
 * Jalankan: npm run test:revenue-basis
 */
import assert from "node:assert/strict";
import { bagiPendapatanBersihMitraKantor } from "../lib/pembayaran-split";
import { validateMitraOmsetPercent } from "../lib/revenue-basis";

function buildRow(
  total: number,
  ppn: number,
  bhp: number,
  uso: number,
  omset: number | null,
  paidSum: number
) {
  const bhpUso = bhp + uso;
  const bersih = Math.max(0, total - ppn - bhpUso);
  const { mitra, kantor } = bagiPendapatanBersihMitraKantor(bersih, omset);
  const tagihanKantor = kantor + ppn + bhpUso;
  return { total, bersih, mitra, kantor, tagihanKantor, bayar: paidSum };
}

function testSplitDefault5050() {
  const { mitra, kantor } = bagiPendapatanBersihMitraKantor(1_000_000, null);
  assert.equal(mitra, 500_000);
  assert.equal(kantor, 500_000);
  assert.equal(mitra + kantor, 1_000_000);
}

function testSplit4060() {
  const { mitra, kantor } = bagiPendapatanBersihMitraKantor(1_000_000, 60);
  assert.equal(mitra, 600_000);
  assert.equal(kantor, 400_000);
}

function testPaidBasisZeroAfterGenerate() {
  const row = buildRow(0, 0, 0, 0, 50, 0);
  assert.equal(row.mitra, 0);
  assert.equal(row.kantor, 0);
  assert.equal(row.tagihanKantor, 0);
}

function testPaidBasisAfterPayment() {
  const row = buildRow(1_000_000, 100_000, 0, 0, 60, 0);
  assert.equal(row.mitra, 540_000);
  assert.equal(row.kantor, 360_000);
  assert.equal(row.tagihanKantor, 460_000);
}

function testInvoiceBasisAfterGenerate() {
  const row = buildRow(1_000_000, 100_000, 0, 0, 50, 0);
  assert.equal(row.mitra, 450_000);
  assert.equal(row.kantor, 450_000);
}

function testOmsetValidation() {
  assert.equal(validateMitraOmsetPercent(null), null);
  assert.equal(validateMitraOmsetPercent(50), null);
  assert.ok(validateMitraOmsetPercent(101));
}

const tests = [
  ["default 50/50", testSplitDefault5050],
  ["custom 60/40 mitra/kantor", testSplit4060],
  ["PAID: bagi hasil 0 setelah generate", testPaidBasisZeroAfterGenerate],
  ["PAID: bagi hasil setelah bayar", testPaidBasisAfterPayment],
  ["INVOICE: bagi hasil setelah generate", testInvoiceBasisAfterGenerate],
  ["validasi omset 0-100", testOmsetValidation],
] as const;

for (const [name, fn] of tests) {
  fn();
  console.log(`✓ ${name}`);
}

console.log(`\n${tests.length}/${tests.length} passed`);
