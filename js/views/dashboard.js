// js/views/dashboard.js
// Vista Dashboard: 9 KPIs + accesos rápidos + jugadores en mora.

import { state, escapeHTML } from '../app.js';
import { classifyMora, moraBadgeClass, moraLabel } from '../services/mora.js';
import { formatMXN, getCurrentQuincena, quincenaLabel, monthYearLabel } from '../utils/dates.js';

export function renderDashboard(root) {
  const current = getCurrentQuincena();
  const stats = computeStats(current);

  root.innerHTML = `
    <section class="flex flex-col gap-6">

      <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-brand-700">Período actual</p>
          <h1 class="font-display font-extrabold text-2xl sm:text-3xl">${monthYearLabel(current.year, current.month)} · ${quincenaLabel(current.year, current.quincena)}</h1>
        </div>
        <p class="muted text-sm">Actualizado al ${new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}</p>
      </header>

      <!-- KPIs principales -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${kpi('Total jugadores',          stats.totalPlayers,           'badge-info', 'Registrados en el club')}
        ${kpi('Pagados (período actual)', stats.currentPaid,            'badge-paid', 'Cobrados en este corte')}
        ${kpi('Pendientes (período actual)', stats.currentPending,     'badge-pending', 'Falta por cobrar')}
        ${kpi('Morosos',                  stats.morosos,                'badge-mora', 'Con atraso >0 días')}
      </div>

      <!-- KPIs económicos -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        ${kpiMoney('Total recaudado',  stats.totalCollected,  'emerald', 'Suma de pagos completados')}
        ${kpiMoney('Total pendiente',  stats.totalPending,    'amber',   'Suma de pagos pendientes')}
      </div>

      <!-- Cortes por quincena -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${quincenaCard('Corte Q1 (días 1–15)',  stats.q1)}
        ${quincenaCard('Corte Q2 (días 16–31)', stats.q2)}
      </div>

      <!-- Jugadores por categoría -->
      <div class="card card-pad">
        <h2 class="font-display font-bold text-lg mb-3">Jugadores por categoría</h2>
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
          ${stats.byCategory.map((c) => categoryTile(c.name, c.count, c.amount)).join('')}
        </div>
      </div>

      <!-- Morosos destacados -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-display font-bold text-lg">Morosos del período</h2>
          <a href="#/payments" class="text-sm font-semibold text-brand-700 hover:underline">Ver todos →</a>
        </div>
        ${stats.morososList.length === 0
          ? `<p class="muted text-sm">Sin morosos. ¡Excelente!</p>`
          : `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${stats.morososList.map(morosoCard).join('')}</div>`
        }
      </div>
    </section>
  `;
}

function kpi(label, value, badgeClass, sub) {
  return `
    <div class="kpi">
      <p class="kpi-label">${label}</p>
      <p class="kpi-value">${value}</p>
      <span class="${badgeClass}">${escapeHTML(sub)}</span>
    </div>
  `;
}
function kpiMoney(label, value, color, sub) {
  const tones = {
    emerald: 'text-emerald-600',
    amber:   'text-amber-600',
  };
  return `
    <div class="kpi">
      <p class="kpi-label">${label}</p>
      <p class="kpi-value ${tones[color] || ''}">${formatMXN(value)}</p>
      <span class="badge badge-neutral">${escapeHTML(sub)}</span>
    </div>
  `;
}
function quincenaCard(label, q) {
  return `
    <div class="card card-pad">
      <p class="kpi-label">${label}</p>
      <div class="flex items-end justify-between mt-1">
        <div>
          <p class="kpi-value text-emerald-600">${q.paid} pagados</p>
          <p class="kpi-value text-amber-600 text-2xl">${q.pending} pendientes</p>
        </div>
        <div class="text-right">
          <p class="text-xs muted">Recaudado</p>
          <p class="font-bold text-lg">${formatMXN(q.collected)}</p>
        </div>
      </div>
      <div class="mt-3 h-2 rounded-full bg-ink-100 overflow-hidden flex">
        <div class="bg-emerald-500 h-full" style="width:${q.paidPct}%"></div>
        <div class="bg-amber-400 h-full" style="width:${q.pendingPct}%"></div>
      </div>
    </div>
  `;
}
function categoryTile(name, count, amount) {
  return `
    <div class="rounded-xl border border-ink-100 p-3 bg-ink-50/40">
      <p class="text-xs font-semibold muted truncate" title="${escapeHTML(name)}">${escapeHTML(name)}</p>
      <p class="font-display font-extrabold text-2xl">${count}</p>
      <p class="text-xs muted">${formatMXN(amount)}</p>
    </div>
  `;
}
function morosoCard(p) {
  const level = classifyMora(p);
  return `
    <div class="rounded-xl border border-red-100 bg-red-50/40 p-3 flex items-center justify-between gap-2">
      <div class="min-w-0">
        <p class="font-semibold truncate">${escapeHTML(p.name)}</p>
        <p class="text-xs muted truncate">${escapeHTML(p.category || '—')}</p>
      </div>
      <span class="${moraBadgeClass(level)} whitespace-nowrap">${moraLabel(level)}</span>
    </div>
  `;
}

// ============ Cálculos ============ //

function computeStats(current) {
  const players  = state.players;
  const payments = state.payments;
  const cats     = state.categories;

  const totalPlayers = players.length;
  const byCategory = cats.map((c) => ({
    name: c.name,
    amount: Number(c.amount) || 0,
    count: players.filter((p) => p.category === c.name).length,
  }));

  // Período actual: buscamos pagos del mismo year+quincena
  const currentPeriodKey = (p) => `${p.year}-${p.quincena}`;
  const curKey = `${current.year}-${current.quincena}`;
  const currentPeriod = payments.filter((p) => currentPeriodKey(p) === curKey);
  const currentPaid    = currentPeriod.filter((p) => p.status === 'paid').length;
  const currentPending = currentPeriod.filter((p) => p.status === 'pending').length;

  // Jugadores en mora: cualquier pago pendiente (cualquier quincena) donde el jugador
  // tiene paymentDay < día actual del mes → mora.
  const morosos = players.filter((p) => classifyMora(p) !== 'recordatorio');
  const morososList = morosos.slice(0, 6);

  // Total recaudado / pendiente
  const totalCollected = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPending   = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);

  // Cortes Q1/Q2 del año actual (todos los meses del año)
  const yearPayments = payments.filter((p) => Number(p.year) === current.year);
  const buildQ = (q) => {
    const list = yearPayments.filter((p) => Number(p.quincena) === q);
    const paid    = list.filter((p) => p.status === 'paid');
    const pending = list.filter((p) => p.status === 'pending');
    const total   = paid.length + pending.length || 1;
    return {
      paid:    paid.length,
      pending: pending.length,
      collected: paid.reduce((s, p) => s + Number(p.amount || 0), 0),
      paidPct:    Math.round((paid.length    / total) * 100),
      pendingPct: Math.round((pending.length / total) * 100),
    };
  };

  return {
    totalPlayers,
    currentPaid,
    currentPending,
    morosos: morosos.length,
    morososList,
    totalCollected,
    totalPending,
    byCategory,
    q1: buildQ(1),
    q2: buildQ(2),
  };
}
