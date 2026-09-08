// js/views/dashboard.js
// Vista Dashboard: hero deportivo + 4 KPIs + barras por categoría + top morosos + CLABE destacada.

import { state, escapeHTML, ICON, avatarGradient, openMessageMenu, findCategoryByName, amountForPlayer } from '../app.js';
import { classifyMora } from '../services/mora.js';
import { formatMXN, getCurrentQuincena, quincenaLabel, monthYearLabel, daysMora, quincenaOfDay } from '../utils/dates.js';

export function renderDashboard(root) {
  const current = getCurrentQuincena();
  const stats = computeStats(current);

  root.innerHTML = `
    <section class="flex flex-col gap-6">

      <!-- HERO -->
      <div class="dash-hero">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <span class="hero-eyebrow">Período actual</span>
            <h1 class="hero-title">${escapeHTML(monthYearLabel(current.year, current.month))}</h1>
            <p class="hero-subtitle">${escapeHTML(quincenaLabel(current.year, current.quincena))}</p>
            <div class="flex flex-wrap items-center gap-2 mt-4">
              <span class="tag tag-brand">Día ${current.day} de ${monthDayCount(current.year, current.month)}</span>
              <span class="tag tag-steel">${stats.totalPlayers} jugadores</span>
              <span class="tag">${stats.currentPct}% cobrado</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <a href="#/players" class="btn-steel">${ICON.users}<span>Jugadores</span></a>
            <a href="#/payments" class="btn-primary">${ICON.plus}<span>Nuevo pago</span></a>
          </div>
        </div>
      </div>

      <!-- KPIs PRINCIPALES -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        ${kpi('Total jugadores',  stats.totalPlayers,  'tag-brand', 'Registrados en el club')}
        ${kpi('Al día',           stats.currentPaid,   'badge-paid', `${stats.currentPct}% del período`)}
        ${kpi('Pendientes',       stats.currentPending,'badge-pending', 'Falta por cobrar')}
        ${kpi('En mora',          stats.morosos,       'badge-mora', 'Con atraso activo')}
      </div>

      <!-- ECONOMIA -->
      <div class="card-dark card-pad">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="section-eyebrow text-brand-300">Economía del club</p>
            <h2 class="section-title text-white">Cobranza del período</h2>
          </div>
          <span class="tag tag-brand">${quincenaLabel(current.year, current.quincena)}</span>
        </div>
        <div class="grid grid-cols-2 gap-4 sm:gap-6">
          <div>
            <p class="text-xs uppercase tracking-widest font-bold text-ink-300">Recaudado</p>
            <p class="font-display font-extrabold text-3xl sm:text-4xl text-emerald-400 tabular-nums leading-none mt-1">${formatMXN(stats.totalCollected)}</p>
            <div class="progress mt-3">
              <div class="bar-paid" style="width:${Math.min(100, stats.economyPct)}%"></div>
              <div class="bar-pending" style="width:${100 - Math.min(100, stats.economyPct)}%"></div>
            </div>
          </div>
          <div>
            <p class="text-xs uppercase tracking-widest font-bold text-ink-300">Por cobrar</p>
            <p class="font-display font-extrabold text-3xl sm:text-4xl text-brand-300 tabular-nums leading-none mt-1">${formatMXN(stats.totalPending)}</p>
            <p class="text-xs text-ink-300 mt-3">${stats.currentPending} pagos pendientes este período</p>
          </div>
        </div>
      </div>

      <!-- PROGRESO POR CATEGORIA -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="section-eyebrow">Por categoría</p>
            <h2 class="section-title">Cobranza del período</h2>
          </div>
          <span class="badge badge-neutral">${stats.totalPlayers} jugadores</span>
        </div>
        <div class="flex flex-col">
          ${stats.byCategory.length === 0
            ? `<p class="muted text-sm py-4 text-center">Aún no hay categorías</p>`
            : stats.byCategory.map(categoryRow).join('')}
        </div>
      </div>

      <!-- TOP MOROSOS + ACCIONES RAPIDAS -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div class="lg:col-span-2 card card-pad">
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="section-eyebrow">Atención prioritaria</p>
              <h2 class="section-title">Morosos</h2>
            </div>
            <a href="#/players" class="btn btn-ghost btn-sm">Ver todos →</a>
          </div>
          ${stats.morososList.length === 0
            ? `<div class="rounded-lg bg-emerald-50 border border-emerald-200 p-6 text-center">
                <div class="empty-state-icon mx-auto" style="background:#D1FAE5;color:#065F46">
                  ${ICON.check}
                </div>
                <p class="font-display font-extrabold text-xl uppercase text-emerald-800">¡Sin morosos!</p>
                <p class="text-sm text-emerald-700 mt-1">Todos los jugadores están al día.</p>
              </div>`
            : `<div class="flex flex-col gap-2">${stats.morososList.map(morosoCard).join('')}</div>`
          }
        </div>

        <!-- DATOS DE PAGO -->
        <div class="card card-pad">
          <p class="section-eyebrow">Cobro rápido</p>
          <h2 class="section-title">Datos bancarios</h2>
          <dl class="mt-4 space-y-3 text-sm">
            <div>
              <dt class="text-xs uppercase tracking-widest font-bold text-ink-500">Banco</dt>
              <dd class="font-bold text-ink-900">Banorte</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-widest font-bold text-ink-500">Titular</dt>
              <dd class="font-bold text-ink-900">Haziel Macias</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-widest font-bold text-ink-500">CLABE</dt>
              <dd class="font-mono font-bold text-ink-900 tabular-nums text-xs sm:text-sm">0725 8001 2420 3994 00</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-widest font-bold text-ink-500">Concepto</dt>
              <dd class="font-bold text-ink-900">Mensualidad</dd>
            </div>
          </dl>
          <button id="dash-copy-clabe" class="btn btn-steel w-full mt-4" type="button">
            ${ICON.copy}<span>Copiar CLABE</span>
          </button>
        </div>
      </div>
    </section>
  `;

  // Wire copy clabe
  const copyBtn = root.querySelector('#dash-copy-clabe');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard?.writeText('072580012420399400');
        copyBtn.textContent = '✓ CLABE copiada';
        setTimeout(() => { copyBtn.innerHTML = `${ICON.copy}<span>Copiar CLABE</span>`; }, 1800);
      } catch { /* ignore */ }
    });
  }

  // Wire moroso message buttons
  root.querySelectorAll('[data-msg-moroso]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.msgMoroso;
      const player = state.players.find((p) => p.id === id);
      if (!player) return;
      const cat = findCategoryByName(player.category);
      const amount = player.customAmount ?? cat?.amount ?? 0;
      openMessageMenu(btn, player, { amount });
    });
  });
}

// ============ COMPONENTES ============ //

function kpi(label, value, badgeClass, sub) {
  return `
    <div class="kpi">
      <div class="flex items-center justify-between">
        <p class="kpi-label">${escapeHTML(label)}</p>
        <span class="badge ${badgeClass}">·</span>
      </div>
      <p class="kpi-value">${value}</p>
      <p class="kpi-sub">${escapeHTML(sub)}</p>
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
        <div class="flex items-center justify-between mb-1.5">
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
  const toneCls = tone === 'red' ? 'badge-mora' : tone === 'orange' ? 'badge-mora' : 'badge-pending';
  const cat = findCategoryByName(p.category);
  const amount = amountForPlayer(p);
  return `
    <div class="moroso-card">
      <div class="player-avatar size-lg" style="${avatarGradient(p.name)}">${escapeHTML(initialsOf(p.name))}</div>
      <div class="min-w-0 flex-1">
        <p class="moroso-name">${escapeHTML(p.name)}</p>
        <p class="player-meta">${escapeHTML(p.category || '—')}</p>
      </div>
      <div class="flex flex-col items-end gap-1">
        <span class="badge ${toneCls}">${dias} ${dias === 1 ? 'día' : 'días'}</span>
        <button data-msg-moroso="${p.id}" type="button" class="icon-btn" aria-label="Copiar mensaje de pago para ${escapeHTML(p.name)}">${ICON.copy}</button>
      </div>
    </div>
  `;
}

function initialsOf(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
}

function monthDayCount(year, month) {
  return new Date(year, month + 1, 0).getDate();
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

  // Pagados / pendientes periodo actual
  const currentPaid    = currentPeriod.filter((p) => p.status === 'paid').length;
  const currentPending = currentPeriod.filter((p) => p.status === 'pending').length;
  const currentTotal   = currentPaid + currentPending;
  const currentPct     = currentTotal ? Math.round((currentPaid / currentTotal) * 100) : 0;

  // Morosos (jugadores pendientes de pago)
  const morososList = players
    .map((p) => ({ ...p, _dias: daysMora(p) }))
    .filter((p) => p._dias > 0)
    .sort((a, b) => b._dias - a._dias)
    .slice(0, 6);
  const morosos = players.filter((p) => classifyMora(p) !== 'recordatorio').length;

  // Recaudado / pendiente (todos los pagos)
  const totalCollected = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPending   = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);
  const economyPct = (totalCollected + totalPending) > 0
    ? Math.round((totalCollected / (totalCollected + totalPending)) * 100)
    : 0;

  return {
    totalPlayers,
    currentPaid,
    currentPending,
    currentPct,
    morosos,
    morososList,
    totalCollected,
    totalPending,
    economyPct,
    byCategory,
  };
}
