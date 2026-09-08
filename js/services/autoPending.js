// services/autoPending.js
// Genera pagos pendientes virtuales basados en el día de pago del jugador.
//
// Regla: AUTO_PENDING_LEAD_DAYS antes del día de pago del jugador, aparece
// un pago pendiente virtual para ese mes. Si el jugador paga (registro real
// con status='paid' en Firestore), el pendiente virtual desaparece.
//
// NO escribe a Firestore: los pendientes son virtuales y se calculan en
// cada render a partir del estado actual. Al marcar como pagado, se crea
// el registro real 'paid' que apaga el pendiente virtual.

export const AUTO_PENDING_LEAD_DAYS = 3;

const _toDate = (d) => (d instanceof Date ? d : new Date());

const daysInMonth = (y, m) => new Date(y, m, 0).getDate();

/**
 * Detecta el período de pago pendiente virtual para un jugador.
 *
 * Reglas:
 *  - Si el jugador está exento, retorna null.
 *  - Verifica el mes actual: si la alerta (paymentDay − LEAD_DAYS) ya pasó
 *    y NO hay registro 'paid' para ese mes, hay pendiente virtual.
 *  - Si el mes actual SÍ está pagado, verifica el mes siguiente:
 *    si su alerta ya pasó, hay pendiente virtual del próximo mes.
 *  - En cualquier otro caso, retorna null (todavía no es momento).
 *
 * @param {{id:string, paymentDay:number, exempt?:boolean}} player
 * @param {Array} payments - lista completa de pagos (reales)
 * @param {Date}  [today]
 * @returns {null | {
 *   year:number, month:number, quincena:1|2,
 *   dueDate:Date, daysUntilDue:number, isOverdue:boolean, reason:'thisMonth'|'nextMonth'
 * }}
 */
export function getAutoPendingPeriod(player, payments, today) {
  const t = _toDate(today);
  const payDay = Number(player?.paymentDay);

  if (!payDay || payDay < 1 || payDay > 31) return null;
  if (player?.exempt) return null;

  const year = t.getFullYear();
  const month = t.getMonth() + 1; // 1-12

  const safeDay = (y, m) => Math.min(payDay, daysInMonth(y, m));

  const paid = (y, m) => (payments || []).some(
    (p) => p.playerId === player.id &&
           Number(p.year) === y &&
           Number(p.month) === m &&
           p.status === 'paid'
  );

  const buildPeriod = (y, m) => {
    const due = new Date(y, m - 1, safeDay(y, m));
    const alert = new Date(due);
    alert.setDate(alert.getDate() - AUTO_PENDING_LEAD_DAYS);
    return { y, m, due, alert };
  };

  const finalize = (y, m, due, reason) => {
    const daysUntil = Math.round((due - t) / 86400000);
    return {
      year: y,
      month: m,
      quincena: safeDay(y, m) <= 15 ? 1 : 2,
      dueDate: due,
      daysUntilDue: daysUntil,
      isOverdue: t > due,
      reason,
    };
  };

  // 1. Mes actual
  const cur = buildPeriod(year, month);
  if (t >= cur.alert && !paid(year, month)) {
    return finalize(year, month, cur.due, 'thisMonth');
  }

  // 2. Si el mes actual está pagado, verificar el siguiente
  if (paid(year, month)) {
    const nextM = month === 12 ? 1 : month + 1;
    const nextY = month === 12 ? year + 1 : year;
    const nxt = buildPeriod(nextY, nextM);
    if (t >= nxt.alert && !paid(nextY, nextM)) {
      return finalize(nextY, nextM, nxt.due, 'nextMonth');
    }
  }

  return null;
}

/**
 * Construye un objeto de pago virtual a partir del período detectado.
 * El `id` es determinístico para permitir identificar el mismo pendiente
 * entre renders (playerId + year + month).
 */
export function buildAutoPendingPayment(player, payments, today, amount) {
  const period = getAutoPendingPeriod(player, payments, today);
  if (!period) return null;
  return {
    id: `auto-${player.id}-${period.year}-${period.month}`,
    playerId: player.id,
    player,
    virtual: true,
    year: period.year,
    month: period.month,
    quincena: period.quincena,
    amount: Number(amount) || 0,
    status: 'pending',
    paidDate: null,
    dueDate: period.dueDate,
    daysUntilDue: period.daysUntilDue,
    isOverdue: period.isOverdue,
  };
}

/**
 * Genera pagos pendientes virtuales para todos los jugadores.
 *
 * @param {Array} players
 * @param {Array} payments
 * @param {Date}  [today]
 * @param {(player:Object)=>number} [getAmount] - función para obtener el monto del jugador
 * @returns {Array} pagos virtuales
 */
export function getAllAutoPending(players, payments, today, getAmount) {
  const t = _toDate(today);
  const result = [];
  for (const player of players || []) {
    const amount = typeof getAmount === 'function' ? getAmount(player) : 0;
    const payment = buildAutoPendingPayment(player, payments, t, amount);
    if (payment) result.push(payment);
  }
  return result;
}

/**
 * Cuenta jugadores por estado de pago del mes actual.
 *
 * @returns {{
 *   paid:number, pending:number, overdue:number,
 *   beforeAlert:number, exempt:number, total:number
 * }}
 */
export function classifyPlayersByStatus(players, payments, today, currentMonth) {
  const t = _toDate(today);
  const result = { paid: 0, pending: 0, overdue: 0, beforeAlert: 0, exempt: 0, total: players.length };
  for (const p of players || []) {
    if (p.exempt) { result.exempt++; continue; }
    const period = getAutoPendingPeriod(p, payments, t);
    if (!period) {
      result.beforeAlert++;
    } else if (period.year === currentMonth.year && period.month === currentMonth.month) {
      if (period.isOverdue) result.overdue++;
      else result.pending++;
    } else {
      // Periodo virtual pertenece a otro mes → su mes actual está pagado
      result.paid++;
    }
  }
  return result;
}
