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
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 mb-5">
            <div>
              <p class="section-eyebrow">Economía del club</p>
              <h2 class="text-base font-semibold mt-1">Cobranza del período</h2>
            </div>
            <span class="text-xs text-zinc-500 tabular-nums">${escapeHTML(quincenaLabel(current.year, current.quincena))} · ${escapeHTML(monthYearLabel(current.year, current.month))}</span>
          </div>

          <!-- 2 stat blocks: Recaudado / Adeudos -->
          <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100 -mx-2">
            <div class="px-2 py-3 sm:py-1 first:pt-0 sm:first:pt-1">
              <div class="flex items-center gap-1.5">
                <span class="status-dot dot-success"></span>
                <p class="text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Recaudado</p>
              </div>
              <p class="text-2xl font-semibold tabular-nums mt-2">${formatMXN(stats.collectedThisPeriod)}</p>
              <p class="text-xs text-zinc-500 mt-1 tabular-nums">${stats.collectedPct}% del esperado · ${stats.currentPaid} jugador${stats.currentPaid === 1 ? '' : 'es'}</p>
            </div>

            <div class="px-2 py-3 last:pb-0 sm:last:pb-1">
              <div class="flex items-center gap-1.5">
                <span class="status-dot dot-danger"></span>
                <p class="text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Adeudos</p>
              </div>
              <p class="text-2xl font-semibold tabular-nums mt-2">${formatMXN(stats.totalAdeudo)}</p>
              <p class="text-xs text-zinc-500 mt-1 tabular-nums">${stats.morosos} jugador${stats.morosos === 1 ? '' : 'es'} en mora</p>
            </div>
          </div>

          <!-- Progreso de cobranza -->
          <div class="mt-5">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs font-medium text-zinc-700">Progreso de cobranza</span>
              <span class="text-xs text-zinc-500 tabular-nums">Esperado: ${formatMXN(stats.expectedThisPeriod)}</span>
            </div>
            <div class="progress progress-lg">
              <div class="bar-paid" style="width:${Math.min(100, stats.collectedPct)}%"></div>
              <div class="bar-pending" style="width:${Math.max(0, 100 - Math.min(100, stats.collectedPct))}%"></div>
            </div>
          </div>

          <!-- Resumen histórico -->
          <div class="mt-5 pt-4 border-t border-zinc-100">
            <p class="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-3">Histórico acumulado</p>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <p class="text-xs text-zinc-500">Esperado / mes</p>
                <p class="text-sm font-semibold tabular-nums mt-1">${formatMXN(stats.expectedMonthly)}</p>
              </div>
              <div>
                <p class="text-xs text-zinc-500">Recaudado</p>
                <p class="text-sm font-semibold tabular-nums mt-1">${formatMXN(stats.totalCollected)}</p>
              </div>
              <div>
                <p class="text-xs text-zinc-500">Pendiente</p>
                <p class="text-sm font-semibold tabular-nums mt-1">${formatMXN(stats.totalPending)}</p>
              </div>
            </div>
          </div>
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
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="section-eyebrow">Por categoría</p>
            <h2 class="text-base font-semibold mt-1">Cobranza del período</h2>
          </div>
          <span class="text-xs text-zinc-500 tabular-nums">${stats.totalPlayers} jugadores</span>
        </div>
        ${stats.byCategory.length === 0
          ? `<p class="text-sm text-zinc-500 py-4 text-center">Aún no hay categorías.</p>`
          : categoryBarsChart(stats.byCategory)
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

function categoryBarsChart(cats) {
  // Filtrar categorías sin pagos (para que la gráfica sea significativa)
  const data = cats.filter((c) => (c.paid + c.pending) > 0);
  if (data.length === 0) {
    return `<p class="text-sm text-zinc-500 py-4 text-center">Aún no hay pagos en este período.</p>`;
  }

  // Encontrar el máximo total entre categorías (para escalar)
  const maxTotal = Math.max(...data.map((c) => c.paid + c.pending), 1);
  const niceMax = niceCeil(maxTotal);

  const W = 560, H = 220;
  const padL = 56, padR = 12, padT = 18, padB = 52;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;
  const stepX = plotW / n;
  const barW = Math.min(46, stepX * 0.55);
  const gridSteps = 4;

  // Grid horizontal + labels Y
  const gridLines = [];
  const yLabels = [];
  for (let i = 0; i <= gridSteps; i++) {
    const v = (niceMax / gridSteps) * i;
    const y = padT + plotH - (v / niceMax) * plotH;
    gridLines.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#F4F4F5" stroke-width="1" />`);
    yLabels.push(`<text x="${padL - 8}" y="${y + 3}" text-anchor="end" font-size="10" fill="#71717A" font-family="Inter, sans-serif" class="tabular-nums">${escapeHTML(compactMoney(v))}</text>`);
  }

  // Barras verticales con segmentos pagado (oscuro) + pendiente (claro) apilados
  const bars = data.map((c, i) => {
    const total = c.paid + c.pending;
    const paidPct = total ? c.paid / total : 0;
    const x = padL + stepX * i + (stepX - barW) / 2;
    const totalH = (total / niceMax) * plotH;
    const paidH = totalH * paidPct;
    const pendingH = totalH - paidH;
    const yBase = padT + plotH;
    const yPaid = yBase - paidH;
    const yPending = yPaid - pendingH;
    const pct = Math.round(paidPct * 100);
    const pctColor = pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444';

    return `
      <g>
        <rect x="${x}" y="${yPending}" width="${barW}" height="${Math.max(pendingH, 0)}" fill="#E4E4E7" rx="3" />
        <rect x="${x}" y="${yPaid}" width="${barW}" height="${Math.max(paidH, 1)}" fill="#09090B" rx="3" />
        <circle cx="${x + barW / 2}" cy="${yPaid - 1}" r="3" fill="${pctColor}" />
        <title>${escapeHTML(c.name)} · ${pct}% cobrado · ${formatMXN(c.paid)} de ${formatMXN(total)}</title>
      </g>
    `;
  }).join('');

  // Labels X: nombre de categoría (truncado a 12 chars) + jugadores · monto
  const xLabels = data.map((c, i) => {
    const x = padL + stepX * i + stepX / 2;
    const total = c.paid + c.pending;
    const pct = total ? Math.round((c.paid / total) * 100) : 0;
    const name = c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name;
    return `
      <g>
        <text x="${x}" y="${H - padB + 16}" text-anchor="middle" font-size="11" fill="#09090B" font-family="Inter, sans-serif" font-weight="500">${escapeHTML(name)}</text>
        <text x="${x}" y="${H - padB + 30}" text-anchor="middle" font-size="10" fill="#71717A" font-family="Inter, sans-serif" class="tabular-nums">${pct}% · ${c.count} jug.</text>
      </g>
    `;
  }).join('');

  return `
    <div class="w-full overflow-x-auto">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de barras vertical: cobranza por categoría" class="w-full h-auto" style="min-width: 420px;">
        ${gridLines.join('')}
        ${yLabels.join('')}
        ${bars}
        ${xLabels}
      </svg>
    </div>
    <div class="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-zinc-100 text-xs text-zinc-600">
      <span class="inline-flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-sm bg-zinc-900"></span>Cobrado</span>
      <span class="inline-flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-sm bg-zinc-200"></span>Pendiente</span>
      <span class="inline-flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>≥70%</span>
      <span class="inline-flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-500"></span>40–69%</span>
      <span class="inline-flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></span>&lt;40%</span>
    </div>
  `;
}

// Helpers de formato para la gráfica
function niceCeil(n) {
  if (n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const f = n / Math.pow(10, exp);
  let nice;
  if (f <= 1) nice = 1;
  else if (f <= 2) nice = 2;
  else if (f <= 5) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exp);
}

function compactMoney(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function morosoRow(p) {
  const dias = daysMora(p);
  const dotClass = dias >= 5 ? 'dot-danger' : dias >= 3 ? 'dot-warning' : 'dot-warning';
  return `
    <div class="moroso-row">
      <div class="avatar size-md" style="${avatarGradient(p)}">${escapeHTML(initialsOf(p.name))}</div>
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

  // ===== Economía del club =====
  // Recaudado del período: solo pagos PAGADOS de la quincena actual
  const collectedThisPeriod = currentPeriod
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  // Esperado del período: suma de mensualidad de TODOS los jugadores activos (no exentos)
  const expectedThisPeriod = players
    .filter((p) => !p.exempt)
    .reduce((s, p) => s + amountForPlayer(p), 0);

  // % cobrado del esperado del período
  const collectedPct = expectedThisPeriod > 0
    ? Math.round((collectedThisPeriod / expectedThisPeriod) * 100)
    : 0;

  // Adeudos: suma de mensualidad de jugadores con MORA ACTIVA (independiente de si hay pago registrado)
  const totalAdeudo = players
    .filter((p) => classifyMora(p) !== 'recordatorio')
    .reduce((s, p) => s + amountForPlayer(p), 0);

  // Histórico
  const totalCollected = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPending   = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);
  const expectedMonthly = players.filter((p) => !p.exempt).reduce((s, p) => s + amountForPlayer(p), 0);

  return {
    totalPlayers,
    currentPaid,
    currentPending,
    currentPct,
    morosos,
    morososList,
    collectedThisPeriod,
    expectedThisPeriod,
    collectedPct,
    totalAdeudo,
    totalCollected,
    totalPending,
    expectedMonthly,
    byCategory,
  };
}
