// js/views/dashboard.js
// Vista Dashboard minimalista: header + stats inline + categorías + morosos.

import { state, escapeHTML, ICON, avatarGradient, openMessageMenu, amountForPlayer } from '../app.js';
import { classifyMora } from '../services/mora.js';
import { formatMXN, getCurrentQuincena, quincenaLabel, monthYearLabel, daysMora } from '../utils/dates.js';

export function renderDashboard(root) {
  const current = getCurrentQuincena();
  const stats = computeStats(current);

  root.innerHTML = `
    <section class="flex flex-col gap-8">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p class="section-eyebrow">${escapeHTML(monthYearLabel(current.year, current.month))} · ${escapeHTML(quincenaLabel(current.year, current.quincena))}</p>
          <h1 class="section-title text-2xl sm:text-3xl mt-1">Dashboard</h1>
        </div>
        <div class="flex gap-2">
          <a href="#/players" class="btn btn-secondary">${ICON.users}<span>Jugadores</span></a>
          <a href="#/payments" class="btn btn-primary">${ICON.plus}<span>Nuevo pago</span></a>
        </div>
      </div>

      <!-- STATS (4 inline) -->
      <div class="card card-pad">
        <div class="grid grid-cols-2 lg:grid-cols-4 divide-x divide-zinc-100">
          ${statBlock('Total jugadores',  stats.totalPlayers,  'Registrados en el club')}
          ${statBlock('Al día',           stats.currentPaid,   `${stats.currentPct}% del período`, 'success')}
          ${statBlock('Pendientes',       stats.currentPending,'Falta por cobrar', 'warning')}
          ${statBlock('Adeudo',           stats.morosos,       'Con atraso activo', 'danger')}
        </div>
      </div>

      <!-- COBRANZA -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="card card-pad">
          <p class="section-eyebrow">Economía del club</p>
          <h2 class="text-base font-semibold mt-1 mb-4">Cobranza del período</h2>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-zinc-500">Recaudado</p>
              <p class="text-xl font-semibold tabular-nums mt-0.5">${formatMXN(stats.totalCollected)}</p>
            </div>
            <div>
              <p class="text-xs text-zinc-500">Por cobrar</p>
              <p class="text-xl font-semibold tabular-nums mt-0.5">${formatMXN(stats.totalPending)}</p>
            </div>
          </div>
          <div class="progress mt-4">
            <div class="bar-paid" style="width:${Math.min(100, stats.economyPct)}%"></div>
            <div class="bar-pending" style="width:${100 - Math.min(100, stats.economyPct)}%"></div>
          </div>
          <p class="text-xs text-zinc-500 mt-2 tabular-nums">${stats.economyPct}% cobrado</p>
        </div>

        <div class="card card-pad">
          <p class="section-eyebrow">Atención prioritaria</p>
          <h2 class="text-base font-semibold mt-1 mb-3">Adeudos</h2>
          ${stats.morososList.length === 0
            ? `<div class="text-center py-6">
                <p class="status"><span class="status-dot dot-success"></span><span>Sin adeudos — todos están al día</span></p>
              </div>`
            : `<div class="flex flex-col">
                ${stats.morososList.map(morosoRow).join('')}
              </div>
              <a href="#/players" class="btn btn-ghost btn-sm mt-2 self-end">Ver todos →</a>`
          }
        </div>
      </div>

      <!-- CATEGORIAS -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="section-eyebrow">Por categoría</p>
            <h2 class="text-base font-semibold mt-1">Cobranza del período</h2>
          </div>
          <span class="text-xs text-zinc-500 tabular-nums">${stats.totalPlayers} jugadores</span>
        </div>
        ${stats.byCategory.length === 0
          ? `<p class="text-sm text-zinc-500 py-4 text-center">Aún no hay categorías.</p>`
          : `<div class="flex flex-col">${stats.byCategory.map(categoryRow).join('')}</div>`
        }
      </div>
    </section>
  `;

  // Wire moroso copy buttons
  root.querySelectorAll('[data-msg-moroso]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.msgMoroso;
      const player = state.players.find((p) => p.id === id);
      if (!player) return;
      openMessageMenu(btn, player, { amount: amountForPlayer(player) });
    });
  });
}

// ============ COMPONENTES ============ //

function statBlock(label, value, sub, tone) {
  const dot = tone === 'success' ? 'dot-success' : tone === 'warning' ? 'dot-warning' : tone === 'danger' ? 'dot-danger' : '';
  return `
    <div class="px-4 sm:px-6 first:pl-0 sm:first:pl-6 last:pr-0 sm:last:pr-6">
      <p class="stat-label">${escapeHTML(label)}</p>
      <p class="stat-value mt-1">${value}</p>
      <div class="flex items-center gap-1.5 mt-1.5">
        ${dot ? `<span class="status-dot ${dot}"></span>` : ''}
        <p class="stat-sub">${escapeHTML(sub)}</p>
      </div>
    </div>
  `;
}

function categoryRow(c) {
  const paid    = c.paid;
  const pending = c.pending;
  const total   = paid + pending;
  const paidPct = total ? Math.round((paid / total) * 100) : 0;
  return `
    <div class="cat-row">
      <div class="flex items-center justify-between mb-1.5">
        <span class="cat-name">${escapeHTML(c.name)}</span>
        <span class="cat-count">${paid}/${total} · ${formatMXN(c.amount)}</span>
      </div>
      <div class="progress">
        <div class="bar-paid"    style="width:${paidPct}%"></div>
        <div class="bar-pending" style="width:${100 - paidPct}%"></div>
      </div>
    </div>
  `;
}

function morosoRow(p) {
  const dias = daysMora(p);
  const dotClass = dias >= 5 ? 'dot-danger' : dias >= 3 ? 'dot-warning' : 'dot-warning';
  return `
    <div class="moroso-row">
      <div class="avatar size-md" style="${avatarGradient(p.name)}">${escapeHTML(initialsOf(p.name))}</div>
      <div class="min-w-0 flex-1">
        <p class="moroso-name">${escapeHTML(p.name)}</p>
        <p class="moroso-meta">${escapeHTML(p.category || '—')}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="status"><span class="status-dot ${dotClass}"></span><span class="tabular-nums">${dias}d</span></span>
        <button data-msg-moroso="${p.id}" type="button" class="icon-btn" aria-label="Copiar mensaje de pago para ${escapeHTML(p.name)}">${ICON.copy}</button>
      </div>
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

  const currentPaid    = currentPeriod.filter((p) => p.status === 'paid').length;
  const currentPending = currentPeriod.filter((p) => p.status === 'pending').length;
  const currentTotal   = currentPaid + currentPending;
  const currentPct     = currentTotal ? Math.round((currentPaid / currentTotal) * 100) : 0;

  const morososList = players
    .map((p) => ({ ...p, _dias: daysMora(p) }))
    .filter((p) => p._dias > 0)
    .sort((a, b) => b._dias - a._dias)
    .slice(0, 5);
  const morosos = players.filter((p) => classifyMora(p) !== 'recordatorio').length;

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
