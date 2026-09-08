// tools/import-excel.js
// Importador desde el Excel "JugadoresAlebrijes_Cobranza".
// Uso desde la consola del navegador:
//
//   await import('./tools/import-excel.js').then(m => m.promptAndApplyImport());
//
// O bien con un boton en la pagina que llame a promptAndApplyImport().

import { players, payments, categories } from '../js/services/firestore.js';
import { toast } from '../js/app.js';
import { parseSheet, SECTION_TO_CATEGORY, CATEGORY_AMOUNT } from './parser.js';

// ============ PREVIEW ============ //

export function previewImport(data) {
  const byCat = {};
  for (const p of data.players) {
    byCat[p.category] = (byCat[p.category] || 0) + 1;
  }
  const byStatus = { AGOSTO: 0, SEPTIEMBRE: 0, PENDIENTE: 0, PAGADO: 0, BECADO: 0 };
  for (const pay of data.payments) {
    if (pay.month === 8 && pay.status === 'paid') byStatus.AGOSTO++;
    else if (pay.month === 9 && pay.status === 'pending') byStatus.SEPTIEMBRE++;
    else if (pay.status === 'pending') byStatus.PENDIENTE++;
    else if (pay.status === 'paid') byStatus.PAGADO++;
  }
  for (const p of data.players) if (p.exempt) byStatus.BECADO++;

  console.group('[Import Preview]');
  console.table(byCat);
  console.table(byStatus);
  console.log('Skipped:', data.skipped);
  console.log('Categorias:', data.categories.map((c) => `${c.name} ($${c.amount})`));
  console.log('Total:', data.players.length, 'jugadores,', data.payments.length, 'pagos');
  console.groupEnd();

  return data;
}

// ============ APPLY ============ //

/**
 * Escribe los datos a Firestore. Devuelve un resumen.
 * @param {{categories:any[], players:any[], payments:any[]}} data
 */
export async function applyImport(data) {
  const summary = { categories: 0, players: 0, payments: 0, skippedExisting: 0 };

  // 1) Categorias: crear las que falten
  const existingCats = await categories.all();
  const existingNames = new Set(existingCats.map((c) => c.name));
  for (const c of data.categories) {
    if (existingNames.has(c.name)) continue;
    await categories.add({ name: c.name, amount: c.amount });
    summary.categories++;
  }

  // 2) Jugadores: evitar duplicados por nombre (case-insensitive)
  const existingPlayers = await players.all();
  const existingByName = new Map(existingPlayers.map((p) => [p.name.trim().toLowerCase(), p]));

  const playerIdByName = new Map();
  for (const p of data.players) {
    const key = p.name.trim().toLowerCase();
    const found = existingByName.get(key);
    if (found) {
      playerIdByName.set(key, found.id);
      summary.skippedExisting++;
      continue;
    }
    const id = await players.add({
      name: p.name,
      phone: p.phone,
      paymentDay: p.paymentDay,
      category: p.category,
      notes: p.notes,
      exempt: !!p.exempt,
      customAmount: p.customAmount,
    });
    playerIdByName.set(key, id);
    summary.players++;
  }

  // 3) Pagos: buscar duplicados por (playerId, year, quincena)
  const existingPays = await payments.all();
  const payKey = (pay) => `${pay.playerId}|${pay.year}|${pay.quincena}`;
  const existingPayKeys = new Set(existingPays.map(payKey));

  for (const pay of data.payments) {
    const playerKey = pay._playerName.trim().toLowerCase();
    const playerId = playerIdByName.get(playerKey);
    if (!playerId) continue;

    const key = `${playerId}|${pay.year}|${pay.quincena}`;
    if (existingPayKeys.has(key)) {
      summary.skippedExisting++;
      continue;
    }
    await payments.add({
      playerId,
      year:       pay.year,
      month:      pay.month,
      quincena:   pay.quincena,
      status:     pay.status,
      paidDate:   pay.paidDate || null,
    });
    summary.payments++;
  }

  return summary;
}

// ============ UI: FILE PICKER ============ //

/**
 * Abre un selector de archivos, parsea el Excel, muestra preview
 * y pide confirmacion antes de escribir a Firestore.
 */
export async function promptAndApplyImport() {
  if (typeof XLSX === 'undefined') {
    console.error('SheetJS (XLSX) no esta cargado. Verifica el <script> en index.html.');
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls,.csv';
  input.style.display = 'none';

  const file = await new Promise((resolve, reject) => {
    input.onchange = () => resolve(input.files[0]);
    input.oncancel = () => reject(new Error('cancelado'));
    document.body.appendChild(input);
    input.click();
  });
  if (!file) return;

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

  const data = parseSheet(rows);
  previewImport(data);

  const ok = window.confirm(
    `Se importaran:\n` +
    `  - ${data.players.length} jugadores\n` +
    `  - ${data.payments.length} pagos\n` +
    `  - ${data.categories.length} categorias (solo las nuevas)\n\n` +
    `¿Continuar?`
  );
  if (!ok) return;

  toast('Importando… esto puede tardar unos segundos', 'info', 6000);
  try {
    const summary = await applyImport(data);
    console.log('[Import] Resultado:', summary);
    toast(`Importación lista: ${summary.players} jugadores, ${summary.payments} pagos`, 'success', 5000);
  } catch (err) {
    console.error('[Import] Error:', err);
    toast('Error durante la importación. Revisa la consola.', 'error');
  }
}

// Expone en window para uso rapido desde la consola
if (typeof window !== 'undefined') {
  window.importarExcel = promptAndApplyImport;
}
