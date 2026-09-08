// utils/dates.js
// Helpers de fecha: mensual, días de adeudo, formateo.
// Los jugadores pagan el día 1 o 15 de cada mes (mensualidad).

// --- DEPRECATED: quincena ---
// Mantenidas para compatibilidad con datos antiguos. NO usar en código nuevo.

/** @deprecated usar new Date() y derivar year/month directamente */
export function getCurrentQuincena(date = new Date()) {
  const day   = date.getDate();
  const year  = date.getFullYear();
  const month = date.getMonth(); // 0-11
  const quincena = day <= 15 ? 1 : 2;
  return { year, month, quincena, day };
}

/** @deprecated no se usa */
export function quincenaRange(year, quincena) {
  if (quincena === 1) {
    return { from: `${year}-01-01`, to: `${year}-01-15`, label: '1-15' };
  }
  const lastMonthDay = new Date(year, 12, 0).getDate();
  return { from: `${year}-XX-16`, to: `${year}-XX-${lastMonthDay}`, label: '16-31' };
}

/**
 * Calcula los días de adeudo de un jugador a partir de su paymentDay (1-31) y la fecha.
 * Regla:
 *  - Si el día actual >= paymentDay del mes actual → adeudo = (hoy - paymentDay).
 *  - Si el día actual < paymentDay del mes actual → adeudo = (días del mes anterior - paymentDay) + hoy.
 *  - Si el jugador está exento (exempt: true) → adeudo = 0.
 *
 * Sin días de gracia.
 *
 * @param {{paymentDay:number, exempt?:boolean}} player
 * @param {Date} today
 * @returns {number} días de adeudo (>= 0)
 */
export function daysOverdue(player, today = new Date()) {
  if (!player || !player.paymentDay) return 0;
  if (player.exempt) return 0;
  const pd = Number(player.paymentDay);
  if (!Number.isFinite(pd) || pd < 1 || pd > 31) return 0;

  const day   = today.getDate();
  const month = today.getMonth();
  const year  = today.getFullYear();

  let lastDate;
  if (day >= pd) {
    lastDate = new Date(year, month, pd);
  } else {
    // Buscar el día 'pd' del mes anterior
    const prevMonth = new Date(year, month - 1, pd);
    lastDate = prevMonth;
  }

  const diffMs = today.getTime() - lastDate.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

/** Devuelve true si el jugador tiene adeudo activo (>0). */
export function isOverdue(player, today = new Date()) {
  return daysOverdue(player, today) > 0;
}

/** Devuelve la quincena (1|2) derivada del día de pago. */
export function quincenaOfDay(day) {
  const d = Number(day);
  if (!Number.isFinite(d)) return 1;
  return d <= 15 ? 1 : 2;
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

/** Etiqueta legible de quincena: "Q1 · 1-15" (sin año, va aparte) */
export function quincenaLabel(year, q) {
  return `Q${q} · ${q === 1 ? '1-15' : '16-31'}`;
}

/** Nombre del mes en español */
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export function monthName(monthIdx) {
  return MONTHS[monthIdx] ?? '';
}

/** Nombre corto del mes (3 letras) */
export function monthShort(monthIdx) {
  const name = monthName(monthIdx);
  return name ? name.slice(0, 3) : '';
}

/** "Agosto 2026" */
export function monthYearLabel(year, monthIdx) {
  return `${monthName(monthIdx)} ${year}`;
}
