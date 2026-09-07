// utils/dates.js
// Helpers de fecha: quincenas, días de mora, formateo.

/** Devuelve {year, quincena (1|2)} a partir de una fecha (default: hoy). */
export function getCurrentQuincena(date = new Date()) {
  const day   = date.getDate();
  const year  = date.getFullYear();
  const month = date.getMonth(); // 0-11
  const quincena = day <= 15 ? 1 : 2;
  return { year, month, quincena, day };
}

/** Devuelve el rango {from, to} ISO (YYYY-MM-DD) de una quincena. */
export function quincenaRange(year, quincena) {
  if (quincena === 1) {
    return { from: `${year}-01-01`, to: `${year}-01-15`, label: '1-15' };
  }
  // Q2: 16-31 (manejo simple: usamos 16 al fin del mes)
  const lastDay = new Date(year, 2, 0).getDate(); // Feb tiene 28/29
  const lastMonthDay = new Date(year, 12, 0).getDate(); // día del último día de dic = 31
  // Para Q2 siempre es 16 a fin de mes (mes en curso). Aquí solo necesitamos label.
  return { from: `${year}-XX-16`, to: `${year}-XX-${lastMonthDay}`, label: '16-31' };
}

/**
 * Calcula los días de mora de un jugador a partir de su paymentDay y la fecha.
 * Regla: si hoy es el día de pago → mora = 0. Desde el día siguiente → mora = 1+.
 * Sin días de gracia.
 *
 * @param {{paymentDay: 1|15}} player
 * @param {Date} today
 * @returns {number} días de mora (>= 0)
 */
export function daysMora(player, today = new Date()) {
  if (!player || ![1, 15].includes(player.paymentDay)) return 0;
  const day = today.getDate();
  // Mora solo aplica cuando ya pasó el día de pago del mes actual.
  if (day < player.paymentDay) return 0;
  return day - player.paymentDay;
}

/** Devuelve true si el jugador está en mora (>0). */
export function isMora(player, today = new Date()) {
  return daysMora(player, today) > 0;
}

/** Formato moneda MXN: $1,200.00 */
export function formatMXN(n) {
  const v = Number(n ?? 0);
  return v.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  });
}

/** YYYY-MM-DD → dd/mm/aaaa */
export function formatDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Fecha relativa simple: "Hoy", "Ayer", "hace 3 días" */
export function relativeDate(s) {
  if (!s) return '—';
  const d   = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const ms  = Date.now() - d.getTime();
  const day = Math.floor(ms / 86_400_000);
  if (day === 0) return 'Hoy';
  if (day === 1) return 'Ayer';
  if (day > 1 && day < 30) return `Hace ${day} días`;
  return formatDate(s);
}

/** Etiqueta legible de quincena: "Q1 - 2026" */
export function quincenaLabel(year, q) {
  return `Q${q} · ${year} · ${q === 1 ? '1-15' : '16-31'}`;
}

/** Nombre del mes en español */
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export function monthName(monthIdx) {
  return MONTHS[monthIdx] ?? '';
}

/** "Agosto 2026" */
export function monthYearLabel(year, monthIdx) {
  return `${monthName(monthIdx)} ${year}`;
}
