// js/views/dashboard.js
// Vista Dashboard minimalista: header + stats inline + categorías + morosos.

import { state, escapeHTML, ICON, avatarGradient, openMessageMenu, amountForPlayer } from '../app.js';
import { classifyAdeudo } from '../services/adeudo.js';
import { getAutoPendingPeriod, getAllAutoPending, classifyPlayersByStatus } from '../services/autoPending.js';
import { formatMXN, monthYearLabel, daysOverdue } from '../utils/dates.js';

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

      <!-- KPI CARDS (4 rediseñados) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${kpiCard({
          label: 'Total jugadores',
          value: stats.totalPlayers,
          icon: 'users',
          tone: 'neutral',
          sub: `${stats.exempt} exento${stats.exempt === 1 ? '' : 's'}${stats.expectedPlayers > 0 ? ` · ${stats.expectedPlayers} por pagar` : ''}`,
        })}
        ${kpiCard({
          label: 'Al día',
          value: stats.currentPaid,
          icon: 'check',
          tone: 'success',
          sub: `${stats.currentPct}% del mes`,
          progress: { total: stats.expectedPlayers, filled: stats.currentPaid, tone: 'success' },
        })}
        ${kpiCard({
          label: 'Pendientes',
          value: stats.currentPending,
          icon: 'clock',
          tone: 'warning',
          sub: stats.currentPending > 0 ? 'Día de pago aún no vence' : 'Sin pendientes en alerta',
          progress: { total: stats.expectedPlayers, filled: stats.currentPending, tone: 'warning' },
        })}
        ${kpiCard({
          label: 'Adeudo',
          value: stats.currentMorosos,
          icon: 'ban',
          tone: 'danger',
          sub: stats.currentMorosos > 0 ? 'Día de pago vencido' : 'Sin adeudos',
          progress: { total: stats.expectedPlayers, filled: stats.currentMorosos, tone: 'danger' },
        })}
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
              <p class="text-xs text-zinc-500 mt-1 tabular-nums">${stats.morosos} jugador${stats.morosos === 1 ? '' : 'es'} con adeudo</p>
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
          <div class="flex items-start justify-between mb-4">
            <div>
              <p class="section-eyebrow">Atención prioritaria</p>
              <h2 class="text-base font-semibold mt-1">Adeudos &amp; Próximos</h2>
            </div>
            <div class="flex items-center gap-3 text-[11px] uppercase tracking-wider tabular-nums">
              <span class="status"><span class="status-dot dot-danger"></span><span>${stats.morosos} vencido${stats.morosos === 1 ? '' : 's'}</span></span>
              <span class="status"><span class="status-dot dot-warning"></span><span>${stats.upcoming} próximo${stats.upcoming === 1 ? '' : 's'}</span></span>
            </div>
          </div>
          ${stats.adeudosList.length === 0
            ? `<div class="text-center py-8">
                <span class="status"><span class="status-dot dot-success"></span><span class="text-zinc-700">Sin adeudos — todos están al día</span></span>
              </div>`
            : `<div class="adeudo-list">
                ${stats.adeudosVencidos.length > 0 ? `
                  <div class="adeudo-group">
                    <div class="adeudo-group-label adeudo-group-label--overdue">
                      <span class="status-dot dot-danger"></span>
                      <span>Vencidos</span>
                      <span class="count-pill">${stats.adeudosVencidos.length}</span>
                    </div>
                    ${stats.adeudosVencidos.map((it) => adeudoRow(it, 'overdue')).join('')}
                  </div>
                ` : ''}
                ${stats.adeudosProximos.length > 0 ? `
                  <div class="adeudo-group">
                    <div class="adeudo-group-label adeudo-group-label--upcoming">
                      <span class="status-dot dot-warning"></span>
                      <span>Próximos a vencer</span>
                      <span class="count-pill">${stats.adeudosProximos.length}</span>
                    </div>
                    ${stats.adeudosProximos.map((it) => adeudoRow(it, 'upcoming')).join('')}
                  </div>
                ` : ''}
              </div>
              <a href="#/players" class="btn btn-ghost btn-sm mt-4 self-end">Ver todos →</a>`
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

  // Wire chart hover tooltips (categorías)
  wireChartTooltip(root, '[data-chart="cat-bars"]', (group) => ({
    name:  group.dataset.name,
    paid:  Number(group.dataset.paid),
    pending: Number(group.dataset.pending),
    expected: Number(group.dataset.expected),
    pct:   Number(group.dataset.pct),
    count: Number(group.dataset.count),
  }), (d) => `
    <p class="tt-title">${escapeHTML(d.name)}</p>
    <div class="tt-rows">
      <div class="tt-row"><span class="tt-label">Cobrado</span><span class="tt-val tabular-nums">${escapeHTML(formatMXN(d.paid))}</span></div>
      <div class="tt-row"><span class="tt-label">Por cobrar</span><span class="tt-val tabular-nums">${escapeHTML(formatMXN(d.pending))}</span></div>
      <div class="tt-row"><span class="tt-label">Esperado</span><span class="tt-val tabular-nums text-zinc-500">${escapeHTML(formatMXN(d.expected))}</span></div>
      <div class="tt-row tt-row--accent"><span class="tt-label">% Cobrado</span><span class="tt-val tabular-nums">${d.pct}%</span></div>
      <div class="tt-row"><span class="tt-label">Jugadores</span><span class="tt-val tabular-nums text-zinc-500">${d.count}</span></div>
    </div>
  `);
}

function wireChartTooltip(root, wrapSel, readData, renderHtml) {
  const wrap = root.querySelector(wrapSel);
  if (!wrap) return;
  const tip = wrap.querySelector('.chart-tooltip');
  if (!tip) return;

  const groups = wrap.querySelectorAll('g[data-name]');
  groups.forEach((g) => {
    g.addEventListener('mouseenter', (e) => {
      const data = readData(g);
      tip.innerHTML = renderHtml(data);
      tip.classList.add('is-visible');
    });
    g.addEventListener('mousemove', (e) => {
      positionTooltip(e, wrap, tip);
    });
    g.addEventListener('mouseleave', () => {
      tip.classList.remove('is-visible');
    });
  });
}

function positionTooltip(e, wrap, tip) {
  const rect = wrap.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const tipRect = tip.getBoundingClientRect();
  const left = Math.min(Math.max(8, x - tipRect.width / 2), rect.width - tipRect.width - 8);
  const top  = Math.max(8, y - tipRect.height - 12);
  tip.style.left = `${left}px`;
  tip.style.top  = `${top}px`;
}

// ============ COMPONENTES ============ //

const KPI_ICON = {
  users:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
  check:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
  clock:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  ban:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
};

const KPI_TONE = {
  neutral: { icon: '#52525B', bar: '#E4E4E7' },
  success: { icon: '#10B981', bar: '#10B981' },
  warning: { icon: '#F59E0B', bar: '#F59E0B' },
  danger:  { icon: '#EF4444', bar: '#EF4444' },
};

function kpiCard({ label, value, icon, tone = 'neutral', sub, progress }) {
  const t = KPI_TONE[tone] || KPI_TONE.neutral;
  const pct = progress && progress.total > 0
    ? Math.min(100, Math.round((progress.filled / progress.total) * 100))
    : 0;
  const progressHTML = progress ? `
    <div class="kpi-progress" aria-hidden="true">
      <div class="kpi-progress-bar" style="width: ${pct}%; background: ${t.bar};"></div>
    </div>
    <p class="kpi-progress-pct">${pct}%</p>
  ` : '';
  return `
    <div class="kpi-card kpi-card--${tone}">
      <div class="kpi-head">
        <span class="kpi-icon" style="color: ${t.icon};">${KPI_ICON[icon] || ''}</span>
        <p class="kpi-label">${escapeHTML(label)}</p>
      </div>
      <p class="kpi-value tabular-nums">${value}</p>
      <p class="kpi-sub">${escapeHTML(sub)}</p>
      ${progressHTML}
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
      <g class="cat-bar" data-name="${escapeHTML(c.name)}" data-paid="${paid}" data-pending="${Math.max(expected - paid, 0)}" data-expected="${expected}" data-pct="${pct}" data-count="${c.count}" style="cursor:pointer;">
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
        <!-- Overlay invisible para capturar hover en todo el alto del plot -->
        <rect class="cat-bar-hit" x="${padL + stepX * i}" y="${padT}" width="${stepX}" height="${plotH}" fill="transparent" />
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
    <div class="chart-wrap" data-chart="cat-bars">
      <div class="w-full overflow-x-auto">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de barras vertical: cobranza por categoría" class="w-full h-auto" style="min-width: 480px;">
          ${gridLines.join('')}
          ${yLabels.join('')}
          ${bars}
          ${xLabels}
        </svg>
      </div>
      <div class="chart-tooltip" role="tooltip" aria-hidden="true"></div>
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

function adeudoRow(item, kind) {
  const p = item.player;
  const absDays = Math.abs(item.daysUntilDue);
  const dotClass = item.isOverdue
    ? (absDays >= 5 ? 'dot-danger' : 'dot-warning')
    : 'dot-warning';
  const statusText = item.isOverdue
    ? `${absDays}d vencido`
    : `En ${absDays}d`;
  const badgeClass = item.isOverdue
    ? (absDays >= 5 ? 'adeudo-badge adeudo-badge--urgent' : 'adeudo-badge adeudo-badge--overdue')
    : 'adeudo-badge adeudo-badge--upcoming';
  return `
    <div class="adeudo-item adeudo-item--${kind}">
      <div class="avatar size-sm" style="${avatarGradient(p)}" aria-hidden="true">${escapeHTML(initialsOf(p.name))}</div>
      <div class="min-w-0 flex-1">
        <p class="ai-name truncate">${escapeHTML(p.name)}</p>
        <p class="ai-meta truncate">${escapeHTML(p.category || 'Sin categoría')} · día ${p.paymentDay || '—'}</p>
      </div>
      <span class="${badgeClass} tabular-nums">${escapeHTML(statusText)}</span>
      <button data-msg-moroso="${p.id}" type="button" class="icon-btn" aria-label="Copiar mensaje para ${escapeHTML(p.name)}">${ICON.copy}</button>
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

  // Desglose de jugadores NO exentos:
  // - currentPaid:     pagaron este mes (registro paid real)
  // - currentPending:  alerta pasada pero el día de pago aún NO vence
  // - currentMorosos:  día de pago vencido sin pago
  // - currentNoAlert:  aún no es momento (alerta no ha pasado)
  const currentPaid    = status.paid;
  const currentPending = status.pending;     // solo alerta pasada sin vencer
  const currentMorosos = status.overdue;
  const currentNoAlert = status.beforeAlert; // aún no es su día

  // Base: jugadores con pago esperado este mes (todos los no exentos)
  const expectedPlayers = currentPaid + currentPending + currentMorosos + currentNoAlert;
  const currentPct = expectedPlayers > 0
    ? Math.round((currentPaid / expectedPlayers) * 100)
    : 0;

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
    .slice(0, 8);

  // División para la UI: vencidos arriba (rojo), próximos abajo (ámbar)
  const adeudosVencidos = adeudosList.filter((it) => it.isOverdue);
  const adeudosProximos = adeudosList.filter((it) => !it.isOverdue);
  const upcoming = adeudosProximos.length;

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

  // Adeudos: suma de mensualidad de jugadores con ADEUDO ACTIVO (independiente de si hay pago registrado)
  const totalAdeudo = players
    .filter((p) => classifyAdeudo(p) !== 'recordatorio')
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
    expectedPlayers,
    currentPaid,
    currentPending,
    currentMorosos,
    currentNoAlert,
    currentPct,
    morosos,
    upcoming,
    adeudosList,
    adeudosVencidos,
    adeudosProximos,
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
