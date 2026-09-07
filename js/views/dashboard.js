// js/views/dashboard.js
// Vista Dashboard: hero + 4 KPIs grandes + 2 KPIs dinero + barras por categoria + top morosos + quick actions.

import { state, escapeHTML, ICON, avatarGradient } from '../app.js';
import { classifyMora } from '../services/mora.js';
import { formatMXN, getCurrentQuincena, quincenaLabel, monthYearLabel, daysMora } from '../utils/dates.js';

export function renderDashboard(root) {
  const current = getCurrentQuincena();
  const stats = computeStats(current);

  root.innerHTML = `
    <section class="flex flex-col gap-6">

      <!-- HERO -->
      <div class="dash-hero p-6 sm:p-8 text-white relative">
        <div class="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p class="text-xs sm:text-sm font-semibold uppercase tracking-wider opacity-80">Período actual</p>
            <h1 class="font-display font-extrabold text-3xl sm:text-4xl leading-tight mt-1">${escapeHTML(monthYearLabel(current.year, current.month))}</h1>
            <p class="font-display text-lg sm:text-xl font-semibold opacity-95">${escapeHTML(quincenaLabel(current.year, current.quincena))}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <a href="#/players" class="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur rounded-xl px-4 py-2.5 text-sm font-semibold transition">
              ${ICON.users}<span>Jugadores</span>
            </a>
            <a href="#/payments" class="inline-flex items-center gap-2 bg-white text-brand-700 hover:bg-brand-50 rounded-xl px-4 py-2.5 text-sm font-bold transition shadow-soft">
              ${ICON.plus}<span>Nuevo pago</span>
            </a>
          </div>
        </div>
      </div>

      <!-- KPIs PRINCIPALES (GRANDES) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        ${kpiHero('Total jugadores',  stats.totalPlayers,  ICON.users,  'kpi-sky',     'Registrados en el club')}
        ${kpiHero('Pagados',          stats.currentPaid,   ICON.check,  'kpi-emerald', `${stats.currentPct}% del período`)}
        ${kpiHero('Pendientes',       stats.currentPending,ICON.clock,  'kpi-amber',   `Falta por cobrar`)}
        ${kpiHero('Morosos',          stats.morosos,       ICON.alert,  'kpi-red',     `Con atraso >0 días`)}
      </div>

      <!-- KPIs ECONOMICOS -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        ${kpiHeroMoney('Total recaudado',  stats.totalCollected, 'kpi-emerald', ICON.cash, 'Suma de todos los pagos completados')}
        ${kpiHeroMoney('Total pendiente',  stats.totalPending,   'kpi-amber',   ICON.bank, 'Suma de pagos aún no cubiertos')}
      </div>

      <!-- PROGRESO POR CATEGORIA -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h2 class="font-display font-bold text-lg">Cobranza por categoría</h2>
            <p class="muted text-xs">Avance del período actual</p>
          </div>
          <span class="badge badge-neutral">${stats.totalPlayers} jugadores</span>
        </div>
        <div class="flex flex-col gap-1">
          ${stats.byCategory.length === 0
            ? `<p class="muted text-sm py-4 text-center">Aún no hay categorías</p>`
            : stats.byCategory.map(categoryRow).join('')}
        </div>
      </div>

      <!-- TOP MOROSOS -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h2 class="font-display font-bold text-lg flex items-center gap-2">
              ${ICON.alert}<span>Morosos del período</span>
            </h2>
            <p class="muted text-xs">Top ${stats.morososList.length} jugadores con atraso</p>
          </div>
          <a href="#/players" class="text-sm font-semibold text-brand-700 hover:underline">Ver todos →</a>
        </div>
        ${stats.morososList.length === 0
          ? `<div class="rounded-xl bg-emerald-50 border border-emerald-200 p-6 text-center">
              <p class="text-2xl mb-1">🎉</p>
              <p class="font-semibold text-emerald-800">¡Sin morosos!</p>
              <p class="text-sm text-emerald-700">Todos los jugadores están al día.</p>
            </div>`
          : `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${stats.morososList.map(morosoCard).join('')}</div>`
        }
      </div>
    </section>
  `;
}

// ============ COMPONENTES ============ //

function kpiHero(label, value, icon, toneClass, sub) {
  return `
    <div class="kpi-hero ${toneClass}">
      <div class="flex items-start justify-between relative z-10">
        <p class="kpi-hero-label">${escapeHTML(label)}</p>
        <div class="kpi-hero-icon bg-white/20">${icon}</div>
      </div>
      <p class="kpi-hero-value relative z-10">${value}</p>
      <p class="kpi-hero-sub relative z-10">${escapeHTML(sub)}</p>
    </div>
  `;
}

function kpiHeroMoney(label, value, toneClass, icon, sub) {
  return `
    <div class="kpi-hero ${toneClass}">
      <div class="flex items-start justify-between relative z-10">
        <p class="kpi-hero-label">${escapeHTML(label)}</p>
        <div class="kpi-hero-icon bg-white/20">${icon}</div>
      </div>
      <p class="kpi-hero-value relative z-10">${formatMXN(value)}</p>
      <p class="kpi-hero-sub relative z-10">${escapeHTML(sub)}</p>
    </div>
  `;
}

function categoryRow(c) {
  const paid    = c.paid;
  const pending = c.pending;
  const total   = paid + pending;
  const paidPct    = total ? Math.round((paid / total) * 100) : 0;
  const pendingPct = total ? 100 - paidPct : 0;
  return `
    <div class="cat-row">
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between mb-1">
          <span class="cat-name">${escapeHTML(c.name)}</span>
          <span class="cat-count">${paid}/${total} · ${formatMXN(c.amount)}</span>
        </div>
        <div class="progress">
          <div class="bar-paid"    style="width:${paidPct}%"></div>
          <div class="bar-pending" style="width:${pendingPct}%"></div>
        </div>
      </div>
    </div>
  `;
}

function morosoCard(p) {
  const dias = daysMora(p);
  const tone = dias >= 5 ? 'red' : dias >= 3 ? 'orange' : 'amber';
  const toneCls = tone === 'red' ? 'bg-red-100 text-red-700' : tone === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-800';
  return `
    <div class="rounded-xl border border-ink-100 bg-white p-3 flex items-center gap-3 hover:border-brand-300 hover:shadow-sm transition">
      <div class="avatar-gradient size-lg" style="${avatarGradient(p.name)}">${escapeHTML(initialsOf(p.name))}</div>
      <div class="min-w-0 flex-1">
        <p class="font-bold truncate text-sm">${escapeHTML(p.name)}</p>
        <p class="text-xs muted truncate">${escapeHTML(p.category || '—')}</p>
      </div>
      <span class="status-pill mora">${dias} ${dias === 1 ? 'día' : 'días'}</span>
    </div>
  `;
}

function initialsOf(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
}

// ============ CALCULOS ============ //

function computeStats(current) {
  const players  = state.players;
  const payments = state.payments;
  const cats     = state.categories;

  const totalPlayers = players.length;

  // Cobranza por categoria del periodo actual
  const currentKey = (p) => `${p.year}-${p.quincena}`;
  const curKey     = `${current.year}-${current.quincena}`;
  const currentPeriod = payments.filter((p) => currentKey(p) === curKey);

  const byCategory = cats.map((c) => {
    const playersInCat = players.filter((p) => p.category === c.name);
    const playerIds = new Set(playersInCat.map((p) => p.id));
    const inPeriod  = currentPeriod.filter((p) => playerIds.has(p.playerId));
    const paid      = inPeriod.filter((p) => p.status === 'paid').length;
    const pending   = playersInCat.length - paid;
    return { name: c.name, amount: Number(c.amount) || 0, paid, pending, count: playersInCat.length };
  });

  // Pagados / pendientes periodo actual (todos los jugadores con pago en el periodo)
  const currentPaid    = currentPeriod.filter((p) => p.status === 'paid').length;
  const currentPending = currentPeriod.filter((p) => p.status === 'pending').length;
  const currentTotal   = currentPaid + currentPending;
  const currentPct     = currentTotal ? Math.round((currentPaid / currentTotal) * 100) : 0;

  // Morosos (jugadores pendientes de pago en cualquier quincena)
  const morososList = players
    .map((p) => ({ ...p, _dias: daysMora(p) }))
    .filter((p) => p._dias > 0)
    .sort((a, b) => b._dias - a._dias)
    .slice(0, 6);
  const morosos = players.filter((p) => classifyMora(p) !== 'recordatorio').length;

  // Recaudado / pendiente (todos los pagos)
  const totalCollected = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPending   = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);

  return {
    totalPlayers,
    currentPaid,
    currentPending,
    currentPct,
    morosos,
    morososList,
    totalCollected,
    totalPending,
    byCategory,
  };
}
