// js/views/dashboard.js
// Vista Dashboard minimalista: header + stats inline + categorías + morosos.

import { state, escapeHTML, ICON, avatarGradient, openMessageMenu, amountForPlayer } from '../app.js';
import { classifyMora } from '../services/mora.js';
import { getAutoPendingPeriod, getAllAutoPending, classifyPlayersByStatus } from '../services/autoPending.js';
import { formatMXN, monthYearLabel, daysMora } from '../utils/dates.js';

export function renderDashboard(root) {
  const today = new Date();
  const current = { year: today.getFullYear(), month: today.getMonth() + 1 };
  const stats = computeStats(current);

  root.innerHTML = `
    <section class="flex flex-col gap-8">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p class="section-eyebrow">${escapeHTML(monthYearLabel(current.year, current.month))}</p>
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
          ${statBlock('Total jugadores',  stats.totalPlayers,  `${stats.exempt} exento${stats.exempt === 1 ? '' : 's'}`)}
          ${statBlock('Al día',           stats.currentPaid,   `${stats.currentPct}% del período`, 'success')}
          ${statBlock('Pendientes',       stats.currentPending,'Alerta pasada · sin pagar', 'warning')}
          ${statBlock('Adeudo',           stats.morosos,       'Día de pago vencido', 'danger')}
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
            <span class="text-xs text-zinc-500 tabular-nums">${escapeHTML(monthYearLabel(current.year, current.month))}</span>
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
          <div class="mt-6 pt-5 border-t border-zinc-100">
            <div class="flex items-baseline justify-between mb-3">
              <p class="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Histórico acumulado</p>
              <p class="text-[11px] text-zinc-400 tabular-nums">${stats.paidPaymentsCount} pagados · ${stats.pendingPaymentsCount} pendientes</p>
            </div>

            ${(stats.totalCollected + stats.totalPending) > 0 ? `
              <div class="mb-4">
                <div class="h-1.5 rounded-full bg-zinc-100 overflow-hidden flex">
                  ${stats.totalCollected > 0 ? `<div class="bg-emerald-500 transition-all" style="width:${(stats.totalCollected / (stats.totalCollected + stats.totalPending)) * 100}%"></div>` : ''}
                  ${stats.totalPending > 0 ? `<div class="bg-amber-400 transition-all" style="width:${(stats.totalPending / (stats.totalCollected + stats.totalPending)) * 100}%"></div>` : ''}
                </div>
                <div class="flex justify-between mt-1.5 text-[10px] text-zinc-500 tabular-nums">
                  <span>${stats.historicalPct}% cobrado</span>
                  <span>${100 - stats.historicalPct}% pendiente</span>
                </div>
              </div>
            ` : `
              <p class="text-xs text-zinc-400 italic mb-4">Aún no hay pagos registrados en el histórico.</p>
            `}

            <div class="grid grid-cols-3 divide-x divide-zinc-100 -mx-1">
              <div class="px-2 first:pl-1">
                <div class="flex items-center gap-1.5 mb-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                  <p class="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Esperado</p>
                </div>
                <p class="text-lg font-semibold tabular-nums text-zinc-900">${formatMXN(stats.expectedMonthly)}</p>
                <p class="text-[11px] text-zinc-500 mt-0.5">Mensual</p>
              </div>
              <div class="px-2">
                <div class="flex items-center gap-1.5 mb-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <p class="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Recaudado</p>
                </div>
                <p class="text-lg font-semibold tabular-nums text-emerald-700">${formatMXN(stats.totalCollected)}</p>
                <p class="text-[11px] text-zinc-500 mt-0.5 tabular-nums">${stats.historicalPct}% del esperado</p>
              </div>
              <div class="px-2 last:pr-1">
                <div class="flex items-center gap-1.5 mb-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <p class="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Pendiente</p>
                </div>
                <p class="text-lg font-semibold tabular-nums text-amber-700">${formatMXN(stats.totalPending)}</p>
                <p class="text-[11px] text-zinc-500 mt-0.5 tabular-nums">${100 - stats.historicalPct}% del esperado</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card card-pad">
          <div class="flex items-start justify-between mb-3">
            <div>
              <p class="section-eyebrow">Atención prioritaria</p>
              <h2 class="text-base font-semibold mt-1">Adeudos</h2>
            </div>
            <div class="text-right">
              <p class="text-[11px] uppercase tracking-wider text-zinc-500 tabular-nums">${stats.morosos} vencido${stats.morosos === 1 ? '' : 's'} · ${stats.currentPending} próximo${stats.currentPending === 1 ? '' : 's'}</p>
            </div>
          </div>
          ${stats.adeudosList.length === 0
            ? `<div class="text-center py-6">
                <p class="status"><span class="status-dot dot-success"></span><span>Sin adeudos — todos están al día</span></p>
              </div>`
            : `<div class="flex flex-col">
                ${stats.adeudosList.map(adeudoRow).join('')}
              </div>
              <a href="#/players" class="btn btn-ghost btn-sm mt-3 self-end">Ver todos →</a>`
          }
        </div>
      </div>

      <!-- CATEGORIAS -->
      <div class="card card-pad">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-5">
          <div>
            <p class="section-eyebrow">Por categoría</p>
            <h2 class="text-base font-semibold mt-1">Cobranza del período</h2>
          </div>
          <div class="text-right">
            <p class="text-[11px] uppercase tracking-wider text-zinc-500">Esperado del mes</p>
            <p class="text-base font-semibold tabular-nums">${formatMXN(stats.byCategory.reduce((s, c) => s + c.expected, 0))}</p>
          </div>
        </div>
        ${stats.byCategory.length === 0 || stats.byCategory.every((c) => c.count === 0)
          ? `<p class="text-sm text-zinc-500 py-6 text-center">Aún no hay jugadores por categoría.</p>`
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
  // Filtrar categorías con jugadores (no exentos)
  const data = cats.filter((c) => c.count > 0);
  if (data.length === 0) {
    return `<p class="text-sm text-zinc-500 py-6 text-center">Aún no hay jugadores por categoría.</p>`;
  }

  // Escala Y: máximo esperado entre categorías, redondeado a número bonito
  const maxExpected = Math.max(...data.map((c) => c.expected), 0);
  const niceMax = niceCeil(maxExpected);

  const W = 600, H = 260;
  const padL = 64, padR = 20, padT = 12, padB = 56;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;
  const stepX = plotW / n;
  const barW = Math.min(58, stepX * 0.6);
  const gridSteps = 5;

  // Eje Y: gridlines + labels formateados en dinero compacto
  const gridLines = [];
  const yLabels = [];
  for (let i = 0; i <= gridSteps; i++) {
    const v = (niceMax / gridSteps) * i;
    const y = padT + plotH - (v / niceMax) * plotH;
    gridLines.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#F4F4F5" stroke-width="1" />`);
    yLabels.push(`<text x="${padL - 10}" y="${y + 3.5}" text-anchor="end" font-size="10.5" fill="#71717A" font-family="Inter, sans-serif" class="tabular-nums">${escapeHTML(compactMoney(v))}</text>`);
  }
  // Línea base (eje X)
  gridLines.push(`<line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#D4D4D8" stroke-width="1" />`);

  // Barras: pending (gris claro, arriba) + paid (oscuro, abajo) apiladas
  const bars = data.map((c, i) => {
    const expected = c.expected;
    const paid = c.paid;
    const pending = Math.max(0, expected - paid);
    const pct = c.pct;
    const dotColor = pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444';

    const x = padL + stepX * i + (stepX - barW) / 2;
    const expectedH = expected > 0 ? (expected / niceMax) * plotH : 0;
    const paidH = expected > 0 ? (paid / niceMax) * plotH : 0;
    const yBase = padT + plotH;
    const yPaidTop = yBase - paidH;
    const yPendingTop = yPaidTop - (expectedH - paidH);

    return `
      <g>
        <!-- Track (outline de la barra esperada, para categorías con poco cobro) -->
        ${expected === 0 ? `
          <rect x="${x}" y="${padT + plotH - 4}" width="${barW}" height="4" fill="#E4E4E7" rx="2" />
        ` : `
          <!-- Pendiente (gris claro) -->
          <rect x="${x}" y="${yPendingTop}" width="${barW}" height="${Math.max(expectedH - paidH, 0)}" fill="#E4E4E7" />
          <!-- Cobrado (oscuro) -->
          <rect x="${x}" y="${yPaidTop}" width="${barW}" height="${Math.max(paidH, 0.5)}" fill="#09090B" />
        `}
        <!-- Indicador de % (dot encima del bar) -->
        ${expected > 0 ? `<circle cx="${x + barW / 2}" cy="${yPaidTop - 1}" r="4" fill="${dotColor}" stroke="#FFFFFF" stroke-width="2" />` : ''}
        <title>${escapeHTML(c.name)} · ${pct}% cobrado · ${formatMXN(paid)} de ${formatMXN(expected)} · ${c.count} jugador${c.count === 1 ? '' : 'es'}</title>
      </g>
    `;
  }).join('');

  // Etiquetas X: nombre categoría (truncado) + % cobrado
  const xLabels = data.map((c, i) => {
    const x = padL + stepX * i + stepX / 2;
    const pct = c.pct;
    const name = c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name;
    return `
      <g>
        <text x="${x}" y="${H - padB + 18}" text-anchor="middle" font-size="11" fill="#09090B" font-family="Inter, sans-serif" font-weight="500">${escapeHTML(name)}</text>
        <text x="${x}" y="${H - padB + 34}" text-anchor="middle" font-size="10" fill="#71717A" font-family="Inter, sans-serif" class="tabular-nums">${pct}% · ${c.count} jug.</text>
      </g>
    `;
  }).join('');

  return `
    <div class="w-full overflow-x-auto">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de barras vertical: cobranza por categoría" class="w-full h-auto" style="min-width: 480px;">
        ${gridLines.join('')}
        ${yLabels.join('')}
        ${bars}
        ${xLabels}
      </svg>
    </div>
    <div class="flex flex-wrap items-center gap-4 mt-5 pt-4 border-t border-zinc-100 text-xs text-zinc-600">
      <span class="inline-flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-sm bg-zinc-900"></span>Cobrado</span>
      <span class="inline-flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-sm bg-zinc-200"></span>Por cobrar</span>
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

function adeudoRow(item) {
  const p = item.player;
  const absDays = Math.abs(item.daysUntilDue);
  const dotClass = item.isOverdue
    ? (absDays >= 5 ? 'dot-danger' : 'dot-warning')
    : 'dot-neutral';
  const statusText = item.isOverdue
    ? `${absDays}d vencido`
    : `En ${absDays}d`;
  return `
    <div class="moroso-row">
      <div class="avatar size-md" style="${avatarGradient(p)}">${escapeHTML(initialsOf(p.name))}</div>
      <div class="min-w-0 flex-1">
        <p class="moroso-name">${escapeHTML(p.name)}</p>
        <p class="moroso-meta">${escapeHTML(p.category || '—')} · día ${p.paymentDay || '—'}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="status"><span class="status-dot ${dotClass}"></span><span class="tabular-nums">${escapeHTML(statusText)}</span></span>
        <button data-msg-moroso="${p.id}" type="button" class="icon-btn" aria-label="Copiar mensaje para ${escapeHTML(p.name)}">${ICON.copy}</button>
      </div>
    </div>
  `;
}

function initialsOf(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
}

// ============ CALCULOS ============ //

function computeStats(current) {
  const today    = new Date();
  const players  = state.players;
  const payments = state.payments;
  const cats     = state.categories;

  const totalPlayers = players.length;
  const exemptCount  = players.filter((p) => p.exempt).length;

  // Filtra pagos del mes actual
  const currentMonthPayments = payments.filter(
    (p) => Number(p.year) === current.year && Number(p.month) === current.month
  );

  const byCategory = cats.map((c) => {
    const playersInCat = players.filter((p) => p.category === c.name && !p.exempt);
    const playerIds = new Set(playersInCat.map((p) => p.id));
    // Monto cobrado del mes (suma de pagos 'paid' de jugadores de esta categoría)
    const paidAmount = currentMonthPayments
      .filter((p) => p.status === 'paid' && playerIds.has(p.playerId))
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    // Esperado del mes (suma de mensualidades de todos los no-exentos de la categoría)
    const expectedAmount = playersInCat.reduce((s, p) => s + amountForPlayer(p), 0);
    const pendingAmount = Math.max(0, expectedAmount - paidAmount);
    return {
      name: c.name,
      paid: paidAmount,
      pending: pendingAmount,
      expected: expectedAmount,
      count: playersInCat.length,
      pct: expectedAmount > 0 ? Math.round((paidAmount / expectedAmount) * 100) : 0,
    };
  });

  // ===== Auto-pending (virtual) — generado por paymentDay =====
  const status = classifyPlayersByStatus(players, payments, today, current);

  // Al día: SOLO jugadores con registro 'paid' real del mes actual
  const currentPaid    = status.paid;
  // Pendientes: aún no pagan (alerta no llegó, o llegó pero no venció)
  const currentPending = status.beforeAlert + status.pending;
  // Adeudo: alerta pasó y día de pago vencido sin pago
  const morosos        = status.overdue;
  const currentTotal   = currentPaid + currentPending + morosos;
  const currentPct     = currentTotal ? Math.round((currentPaid / currentTotal) * 100) : 0;

  // Lista de Adeudos: combina pendientes (próximos) + vencidos, ordenados por urgencia
  const adeudosList = getAllAutoPending(players, payments, today, amountForPlayer)
    .filter((ap) => ap.year === current.year && ap.month === current.month)
    .map((ap) => ({
      player: ap.player,
      dueDate: ap.dueDate,
      daysUntilDue: ap.daysUntilDue, // negativo = vencido, positivo = próximo
      isOverdue: ap.isOverdue,
    }))
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue) // más urgentes primero
    .slice(0, 6);

  // ===== Economía del club =====
  // Recaudado del período: solo pagos PAGADOS del mes actual
  const collectedThisPeriod = currentMonthPayments
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
  const expectedMonthly = players.filter((p) => !p.exempt).reduce((s, p) => s + amountForPlayer(p), 0);
  // Pendiente = Esperado − Recaudado (lo que falta por cobrar del mes actual)
  const totalPending = Math.max(0, expectedMonthly - totalCollected);
  const paidPaymentsCount    = payments.filter((p) => p.status === 'paid').length;
  const pendingPaymentsCount = payments.filter((p) => p.status === 'pending').length;
  // % cobrado del esperado mensual
  const historicalPct = expectedMonthly > 0
    ? Math.round((totalCollected / expectedMonthly) * 100)
    : 0;

  return {
    totalPlayers,
    exempt: exemptCount,
    currentPaid,
    currentPending,
    currentPct,
    morosos,
    adeudosList,
    collectedThisPeriod,
    expectedThisPeriod,
    collectedPct,
    totalAdeudo,
    totalCollected,
    totalPending,
    expectedMonthly,
    paidPaymentsCount,
    pendingPaymentsCount,
    historicalPct,
    byCategory,
  };
}
