// tools/test-import.mjs
// Test del parser con el Excel real. No toca Firestore.
//
// Uso: node tools/test-import.mjs

import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const { parseSheet, SECTION_TO_CATEGORY, CATEGORY_AMOUNT } = await import('./parser.js');

const filePath = process.argv[2] || 'JugadoresAlebrijes_Cobranza_AGOSTO-2Periodo.xlsx';
const buffer = readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

console.log('Filas leídas:', rows.length);
console.log('');

// Forzar "now" al 7 de septiembre de 2026 para que el test sea deterministico
const NOW = new Date('2026-09-07T12:00:00');

const data = parseSheet(rows, NOW);

const byCat = {};
for (const p of data.players) byCat[p.category] = (byCat[p.category] || 0) + 1;
console.log('Por categoria:');
console.table(byCat);
console.log('');

const byStatus = { AGOSTO: 0, SEPTIEMBRE: 0, PENDIENTE: 0, PAGADO: 0, BECADO: 0 };
for (const pay of data.payments) {
  if (pay.month === 8 && pay.status === 'paid') byStatus.AGOSTO++;
  else if (pay.month === 9 && pay.status === 'pending') byStatus.SEPTIEMBRE++;
  else if (pay.status === 'pending') byStatus.PENDIENTE++;
  else if (pay.status === 'paid') byStatus.PAGADO++;
}
for (const p of data.players) if (p.exempt) byStatus.BECADO++;
console.log('Por status:');
console.table(byStatus);
console.log('');

console.log('--- JUGADORES ---');
for (const p of data.players) {
  const tag = p.exempt ? ' [BECADO]' : '';
  const amt = p.customAmount ? `$${p.customAmount}` : '(cat)';
  console.log(`  ${p.category.padEnd(16)} | ${p.name.padEnd(38)} | dia ${String(p.paymentDay).padStart(2)} | ${amt}${tag}`);
}
console.log('');

console.log('--- PAGOS ---');
for (const pay of data.payments) {
  const m = String(pay.month).padStart(2, '0');
  const pd = pay.paidDate ? ` (${pay.paidDate})` : '';
  console.log(`  ${pay._playerName.padEnd(38)} ${pay.year}-${m} Q${pay.quincena} ${pay.status}${pd}`);
}
console.log('');

if (data.skipped.length) {
  console.log('--- SKIPPED ---');
  for (const s of data.skipped) console.log(`  Fila ${s.row}: ${s.name} - ${s.reason}`);
  console.log('');
}

console.log('TOTALES:');
console.log(`  Jugadores: ${data.players.length}`);
console.log(`  Pagos:     ${data.payments.length}`);
console.log(`  Skipped:   ${data.skipped.length}`);
