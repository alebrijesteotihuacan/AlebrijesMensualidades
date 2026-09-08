// tools/parser.js
// Parser puro (sin dependencias de Firebase/DOM). Sirve para tests en Node y para
// el modulo de importacion que se carga en el navegador.

/** Seccion detectada en el Excel -> nombre canonico de categoria. */
export const SECTION_TO_CATEGORY = {
  'ALEBRIJES OAXACA TEOTIHUACAN': 'Alebrijes TDP',
  'SOLES TEOTIHUACAN':            'Soles TDP',
  'SUB - 14':                     'Sub-14',
  'SUB - 16':                     'Sub-16',
  'SUB - 18':                     'Sub-18',
  'CEFODE':                       'Sub-13',
  'CURSO DE VERANO':              'Sub-13',
};

/** Monto por defecto de cada categoria. */
export const CATEGORY_AMOUNT = {
  'Alebrijes TDP': 1200,
  'Soles TDP':     1200,
  'Sub-14':        750,
  'Sub-16':        750,
  'Sub-18':        750,
  'Sub-13':        850,
};

/** Quincena (1|2) derivada del dia de pago. */
export function quincenaOf(day) {
  return Number(day) <= 15 ? 1 : 2;
}

function norm(s) {
  return String(s || '').trim().toUpperCase()
    .replace(/[ÁÀÄ]/g, 'A').replace(/[ÉÈË]/g, 'E').replace(/[ÍÌÏ]/g, 'I')
    .replace(/[ÓÒÖ]/g, 'O').replace(/[ÚÙÜ]/g, 'U').replace(/Ñ/g, 'N');
}

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Convierte la matriz de filas del Excel en { categories, players, payments }.
 * @param {Array<Array<any>>} rows
 * @param {Date} [now]
 */
export function parseSheet(rows, now = new Date()) {
  const playersList = [];
  const paymentsList = [];
  const skipped     = [];
  let currentSection = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const nameCell = String(row[2] || '').trim();
    const phoneCell = String(row[3] || '').trim();
    const dayCell  = String(row[4] || '').trim();
    const amountCell = String(row[5] || '').trim();
    const statusCell = String(row[6] || '').trim().toUpperCase();
    const notesCell  = String(row[7] || '').trim();

    const sectionKey = norm(nameCell);
    if (SECTION_TO_CATEGORY[sectionKey]) {
      currentSection = SECTION_TO_CATEGORY[sectionKey];
      continue;
    }

    if (!nameCell || nameCell === 'NOMBRE' || nameCell === 'T/P') continue;
    if (!currentSection) continue;

    let paymentDay = parseInt(dayCell, 10);
    // Curso de Verano: columna DIA PAGO trae una edad -> default 1
    if (currentSection === 'Sub-13' && (!Number.isFinite(paymentDay) || paymentDay < 1 || paymentDay > 31)) {
      paymentDay = 1;
    }
    if (!Number.isFinite(paymentDay) || paymentDay < 1 || paymentDay > 31) {
      skipped.push({ row: i + 1, name: nameCell, reason: `Día inválido: "${dayCell}"` });
      continue;
    }

    const amount = Number(String(amountCell).replace(/[$,\s]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      skipped.push({ row: i + 1, name: nameCell, reason: `Monto inválido: "${amountCell}"` });
      continue;
    }

    const isExempt  = statusCell === 'BECADO';
    const status    = isExempt ? 'BECADO' : statusCell;
    const category  = currentSection;
    const isDefault = amount === CATEGORY_AMOUNT[category];

    const notes = notesCell && notesCell.toUpperCase() !== 'MP'
      ? notesCell
      : (status === 'PENDIENTE' ? 'Pendiente' : '');

    const player = {
      name: nameCell,
      phone: phoneCell,
      paymentDay,
      category,
      notes,
      exempt: isExempt,
      customAmount: isDefault ? null : amount,
    };
    playersList.push(player);

    const payment = buildPayment(player, status, now);
    if (payment) paymentsList.push({ ...payment, _playerName: nameCell });
  }

  return {
    categories: Object.entries(CATEGORY_AMOUNT).map(([name, amount]) => ({ name, amount })),
    players:    playersList,
    payments:   paymentsList,
    skipped,
  };
}

function buildPayment(player, status, now) {
  const year = now.getFullYear();
  const q = quincenaOf(player.paymentDay);

  if (status === 'BECADO') return null;

  if (status === 'AGOSTO') {
    const paidDate = new Date(year, 8, 0);
    return { year, month: 8, quincena: q, status: 'paid', paidDate: toISO(paidDate) };
  }

  if (status === 'SEPTIEMBRE') {
    return { year, month: 9, quincena: q, status: 'pending', paidDate: null };
  }

  if (status === 'PAGADO') {
    return { year, month: now.getMonth() + 1, quincena: q, status: 'paid', paidDate: toISO(now) };
  }

  if (status === 'PENDIENTE') {
    const day = now.getDate();
    const monthNum = day >= player.paymentDay ? now.getMonth() + 1 : now.getMonth();
    return { year, month: monthNum, quincena: q, status: 'pending', paidDate: null };
  }

  return null;
}
