// tools/import-pasted.js
// Importador con los datos pegados manualmente en el chat.
// Al importarlo desde la consola, sube 37 jugadores y 36 pagos a Firestore.
//
// Uso desde la consola del navegador:
//
//   await import('./tools/import-pasted.js');

import { players, payments, categories } from '../js/services/firestore.js';
import { toast } from '../js/app.js';
import { parseSheet } from './parser.js';

// Datos pegados (texto crudo con tabs)
const PASTED_DATA = `JUGADORES LOCALES
\tALEBRIJES OAXACA TEOTIHUACÁN
T/P\tNOMBRE\tNÚMERO\tDIA PAGO\tMONTO\tESTATUS
\tBRANDON UZIEL MOYA MARQUEZ\t55 2343 7484\t15\t$1,200.00\tAGOSTO
\tDIEGO IVAN RAMIREZ\t56 4322 5500\t15\t$1,200.00\tAGOSTO
\tFRANCO LUCIANO CRUZ BENITEZ\t56 5898 8671\t1\t$1,200.00\tSEPTIEMBRE
\tJUAN CARLOS MARAVILLA MALDONADO\t77 5160 3359\t1\t$1,200.00\tSEPTIEMBRE
\tJUSTIN ANDERSON AGUILAR HERNANDEZ\t55 3634 2101\t15\t$1,200.00\tAGOSTO
\tSOLES TEOTIHUACÁN
T/P\tNOMBRE\tNÚMERO\tDIA PAGO\tMONTO\tESTATUS
\tJOHAN IVAN ROBLES CID\t55 6218 3585\t15\t$1,200.00\tAGOSTO
\tELIOT OMAR CUEVAS ALCALA\t56 1109 4458\t1\t$1,200.00\tSEPTIEMBRE
\tMIGUEL ANGEL RODRIGUEZ LUNA\t56 1802 2683\t15\t$1,200.00\tBECADO
\tCESAR ALEXANDER HERNANDEZ ZACARIAS\t56 1257 7386\t1\t$750.00\tSEPTIEMBRE
\tGERARDO ANTONIO ROMAN TELLEZ\t77 7132 1164\t15\t$1,200.00\tAGOSTO
\tIAN ALEXANDER GARCIA MARTINEZ\t56 6171 0725\t1\t$1,200.00\tSEPTIEMBRE
\tSUB - 14
T/P\tNOMBRE\tNÚMERO\tDIA PAGO\tMONTO\tESTATUS
\tSANTIAGO VARGAS MARTINEZ\t5641023483\t1\t$750.00\tSEPTIEMBRE
\tHUGO HERRERA MUÑOZ\t5525672085\t15\t$750.00\tAGOSTO
\tOSCAR MATA PLIEGO\t55 6335 8143\t1\t$750.00\tPENDIENTE
\tMATTEO GONZALEZ RODRIGUEZ\t55 79 219635\t10\t$750.00\tAGOSTO
\tIRVING NUÑEZ FUENTES\t55 6468 6355\t15\t$750.00\tAGOSTO
\tDOMINGO ANTONIO GONZALEZ\t55 4544 2845\t28\t$750.00\tSEPTIEMBRE
\tNICOLAS OLIVA PEREZ\t55 1234 1280\t15\t$750.00\tAGOSTO
\tALVARO SANTIAGO MARTINEZ GONZALEZ\t55 7497 5066\t15\t$750.00\tAGOSTO
\tMAXIMILIANO GARCIA GUTIERREZ\t55 1193 3900\t24\t$750.00\tSEPTIEMBRE
\tFABIAN ALEXANDER ARGUETA DE LA ROSA\t56 3701 0684\t1\t$750.00\tPENDIENTE
\tARES ANDRE GOMEZ JIMÉNEZ\t55 1435 1842\t1\t$750.00\tSEPTIEMBRE
\tSAID MEDINA ROJAS\t56 2333 0384\t1\t$750.00\tSEPTIEMBRE
\tSUB - 16
T/P\tNOMBRE\tNÚMERO\tDIA PAGO\tMONTO\tESTATUS
\tMAURICIO MENDOZA MUNGUIA\t5636295665\t1\t$750.00\tSEPTIEMBRE
\tURIEL URIETA\t5548905875\t1\t$750.00\tSEPTIEMBRE
\tSUB - 18
T/P\tNOMBRE\tNÚMERO\tDIA PAGO\tMONTO\tESTATUS
\tMARCO ANTONIO VELASCO FLORES\t55 4725 6667\t15\t$750.00\tAGOSTO
\tROBERTO MANUEL JIMENEZ MEJIA\t55 4673 4155\t1\t$750.00\tPENDIENTE
\tGERARD ALAIN OLIVARES HERNANDEZ\t55 4643 7900\t1\t$750.00\tSEPTIEMBRE
\tCEFODE
T/P\tNOMBRE\tNÚMERO\tDIA PAGO\tMONTO\tESTATUS
\tLEONEL VEGA CASTRO\t55 3045 2514\t1\t$425.00\tSEPTIEMBRE
\tMATEO ALEJANDRO VEGA CASTRO\t55 3045 2514\t1\t$425.00\tSEPTIEMBRE
\tENRIQUE MARTINEZ HERNANDEZ\t55 7793 3923\t15\t$550.00\tPENDIENTE
\tCURSO DE VERANO
T/P\tNOMBRE\tNÚMERO\tEDAD\tMONTO\tESTATUS
\tISSAC FRANCO MEDINA GONZALEZ\t55 2253 9350\tMEDIANO (13)\t$850.00\tPAGADO
\tYASMIN ISMAEL ANACLETO BLANCO\t55 7912 2581\tMEDIANO (13)\t$850.00\tPAGADO
\tYASIR ALEXANDER ANACLETO BLANCO\t56 7912 2581\tMEDIANO (13)\t$850.00\tPAGADO
\tMARCO ANTONIO DIAZ RAMIREZ\t55 8467 3550\tMEDIANO (12)\t$850.00\tPAGADO
\tLEONARDO VALENTINO VERGARA PÉREZ\t55 3928 7813\tGRANDE (9)\t$850.00\tPAGADO
\tSEBASTIAN CALÉB VILLAREAL MERCADO\t56 1344 4053\tCHICO (9)\t$850.00\tPAGADO`;

// Convierte el texto pegado a la misma estructura de filas que produce XLSX header:1
function pastedToRows(text) {
  return text.split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const cleaned = line.startsWith('\t') ? line.slice(1) : line;
      const cols = cleaned.split('\t');
      while (cols.length < 8) cols.push('');
      cols.unshift('', '');
      return cols;
    });
}

async function applyImport(data) {
  const summary = { categories: 0, players: 0, payments: 0, skippedExisting: 0 };

  const existingCats = await categories.all();
  const existingNames = new Set(existingCats.map((c) => c.name));
  for (const c of data.categories) {
    if (existingNames.has(c.name)) continue;
    await categories.add({ name: c.name, amount: c.amount });
    summary.categories++;
  }

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
      year:     pay.year,
      month:    pay.month,
      quincena: pay.quincena,
      status:   pay.status,
      paidDate: pay.paidDate || null,
    });
    summary.payments++;
  }

  return summary;
}

// Auto-ejecución al cargar el módulo
(async () => {
  try {
    const rows = pastedToRows(PASTED_DATA);
    const data = parseSheet(rows);

    console.group('[Import Pegado]');
    console.log('Categorias:', data.categories.length);
    console.log('Jugadores:', data.players.length);
    console.log('Pagos:', data.payments.length);
    console.log('Skipped:', data.skipped);
    console.groupEnd();

    toast(`Importando ${data.players.length} jugadores…`, 'info', 6000);
    const summary = await applyImport(data);
    console.log('[Import] Resultado:', summary);
    toast(
      `Listo: ${summary.players} jugadores, ${summary.payments} pagos` +
      (summary.skippedExisting ? ` (${summary.skippedExisting} ya existían)` : ''),
      'success',
      6000
    );
  } catch (err) {
    console.error('[Import] Error:', err);
    toast('Error durante la importación. Revisa la consola.', 'error');
  }
})();

export { pastedToRows, applyImport, PASTED_DATA };
