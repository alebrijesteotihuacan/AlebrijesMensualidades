// js/views/stats.js
// Vista Estadísticas: filtros por año/mes + KPIs del período
// + comparación con período anterior + gráficas mejoradas (barras apiladas,
// línea con área, pastel por categoría).

import { state, escapeHTML } from '../app.js';
import { formatMXN, monthName, monthShort } from '../utils/dates.js';

let _filter = null; // { year, month ('all'|1..12) }

export function renderStats(root) {
  const today = new Date();
  if (!_filter) {
    _filter = { year: today.getFullYear(), month: String(today.getMonth() + 1) };
  } else {
    const years = availableYears();
    if (!years.includes(_filter.year)) _filter.year = today.getFullYear();
  }

  paint(root);
}

function paint(root) {
  const stats     = computeStats(_filter);
  const prev      = computePrevious(_filter);
  const bars      = computeBarData(_filter);     // 12 meses: recaudación y pendiente
  const lines     = computeLineData(_filter);    // 12 meses: % cobrado
  const byCategory = computeByCategory(_filter);
  const donut     = computeCategoryShare(byCategory, stats);

  root.innerHTML = `
    <section class="flex flex-col gap-6">
      <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p class="section-eyebrow">Período ${escapeHTML(periodLabel(_filter))}</p>
          <h1 class="section-title text-2xl sm:text-3xl mt-1">Estadísticas</h1>
        </div>
        <button id="reset-filter" type="button" class="btn btn-secondary btn-sm">
          <svg viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.1a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.277z" clip-rule="evenodd"/></svg>
          <span>Período actual</span>
        </button>
      </header>

      <!-- Filtros -->
      <div class="card card-pad">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label class="label" for="s-year">Año</label>
            <select id="s-year" class="select">
              ${availableYears().map((y) => `<option value="${y}" ${_filter.year === y ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label" for="s-month">Mes</label>
            <select id="s-month" class="select">
              <option value="all" ${_filter.month === 'all' ? 'selected' : ''}>Todo el año</option>
              ${[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => `<option value="${m}" ${_filter.month === String(m) ? 'selected' : ''}>${escapeHTML(monthName(m - 1))}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- KPIs del período seleccionado -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-5">
          <div>
            <p class="section-eyebrow">Período seleccionado</p>
            <h2 class="text-base font-semibold mt-1">${escapeHTML(periodLabel(_filter))}</h2>
          </div>
          <span class="status"><span class="status-dot dot-neutral"></span><span>${stats.totalPagos} pago${stats.totalPagos === 1 ? '' : 's'}</span></span>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          ${kpiCard({ label: 'Recaudado', value: formatMXN(stats.recaudado), sub: `${stats.cobradoPct}% del esperado`, progress: { pct: stats.cobradoPct, tone: stats.cobradoPct >= 70 ? 'success' : stats.cobradoPct >= 40 ? 'warning' : 'danger' }, icon: 'cash' })}
          ${kpiCard({ label: 'Pendiente', value: formatMXN(stats.pendiente), sub: `${stats.pendientePagos} pago${stats.pendientePagos === 1 ? '' : 's'} sin completar`, progress: { pct: 100 - stats.cobradoPct, tone: 'warning' }, icon: 'clock' })}
          ${kpiCard({ label: '% Cobrado', value: `${stats.cobradoPct}%`, sub: `${stats.cobradoPagos} de ${stats.totalPagos}`, progress: { pct: stats.cobradoPct, tone: stats.cobradoPct >= 70 ? 'success' : stats.cobradoPct >= 40 ? 'warning' : 'danger' }, icon: 'check' })}
          ${kpiCard({ label: 'Jugadores', value: stats.jugadoresUnicos, sub: `con al menos un pago`, icon: 'users' })}
        </div>
      </div>

      <!-- Comparación con período anterior -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="section-eyebrow">Comparación</p>
            <h2 class="text-base font-semibold mt-1">vs ${escapeHTML(periodLabel(prev.filter))}</h2>
          </div>
          <span class="text-xs text-zinc-500">${prevStatsLabel(prev, stats)}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          ${compareBlock('Recaudado', formatMXN(stats.recaudado), formatMXN(prev.recaudado), deltaPct(stats.recaudado, prev.recaudado))}
          ${compareBlock('Pendiente', formatMXN(stats.pendiente), formatMXN(prev.pendiente), deltaPct(stats.pendiente, prev.pendiente))}
          ${compareBlock('% Cobrado', `${stats.cobradoPct}%`,     `${prev.cobradoPct}%`,     stats.cobradoPct - prev.cobradoPct, true)}
        </div>
      </div>

      <!-- GRÁFICA DE BARRAS APILADAS: Recaudación vs pendiente -->
      <div class="card card-pad">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
          <div>
            <p class="section-eyebrow">Tendencia mensual</p>
            <h2 class="text-base font-semibold mt-1">Recaudación vs Pendiente · ${_filter.year}</h2>
          </div>
          <div class="flex items-center gap-3 text-xs">
            <span class="inline-flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-sm" style="background:#09090B"></span>Recaudado</span>
            <span class="inline-flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-sm" style="background:#E4E4E7"></span>Pendiente</span>
          </div>
        </div>
        ${barsChart(bars)}
        <p class="text-[11px] text-zinc-500 mt-3">Pasa el cursor sobre una barra para ver el detalle del mes.</p>
      </div>

      <!-- GRÁFICA DE LÍNEAS CON ÁREA: % cobrado por mes -->
      <div class="card card-pad">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
          <div>
            <p class="section-eyebrow">Evolución</p>
            <h2 class="text-base font-semibold mt-1">% Cobrado por mes · ${_filter.year}</h2>
          </div>
          <span class="text-xs text-zinc-500 tabular-nums">Promedio: ${lines.avg}%</span>
        </div>
        ${linesChart(lines)}
        <p class="text-[11px] text-zinc-500 mt-3">Pasa el cursor sobre un punto para ver el detalle del mes.</p>
      </div>

      <!-- DISTRIBUCIÓN POR CATEGORÍA: tabla + pastel -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="section-eyebrow">Por categoría</p>
            <h2 class="text-base font-semibold mt-1">Cobranza del período</h2>
          </div>
          <span class="text-xs text-zinc-500 tabular-nums">${byCategory.length} categorías</span>
        </div>
        ${byCategory.length === 0
          ? `<p class="text-sm text-zinc-500 py-6 text-center">Sin categorías con pagos en este período.</p>`
          : `<div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div class="lg:col-span-3">
                <div class="table-wrap overflow-x-auto">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Categoría</th>
                        <th class="text-right">Recaudado</th>
                        <th class="text-right">Pendiente</th>
                        <th class="text-right hidden sm:table-cell">Total esperado</th>
                        <th class="text-right">% Cobrado</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${byCategory.map(catRow).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="lg:col-span-2">
                ${donutChart(donut)}
              </div>
            </div>`
        }
      </div>
    </section>
  `;

  // Wire filters
  root.querySelector('#s-year').addEventListener('change', (e) => {
    _filter.year = Number(e.target.value);
    paint(root);
  });
  root.querySelector('#s-month').addEventListener('change', (e) => {
    _filter.month = e.target.value;
    paint(root);
  });
  root.querySelector('#reset-filter').addEventListener('click', () => {
    const t = new Date();
    _filter = { year: t.getFullYear(), month: String(t.getMonth() + 1) };
    paint(root);
  });

  // Wire chart hover tooltips
  wireStatsTooltip(root);
}

// ============ COMPONENTES UI ============ //

const KPI_SVG = {
  cash:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  clock:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  check:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
  users:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
};

function kpiCard({ label, value, sub, progress, icon }) {
  const tone = progress?.tone || 'neutral';
  const toneColor = tone === 'success' ? '#10B981' : tone === 'warning' ? '#F59E0B' : tone === 'danger' ? '#EF4444' : '#52525B';
  const progressHTML = progress ? `
    <div class="kpi-progress" aria-hidden="true">
      <div class="kpi-progress-bar" style="width: ${Math.min(100, progress.pct)}%; background: ${toneColor};"></div>
    </div>
  ` : '';
  return `
    <div class="kpi-card kpi-card--${tone}">
      <div class="kpi-head">
        <span class="kpi-icon" style="color: ${toneColor};">${KPI_SVG[icon] || ''}</span>
        <p class="kpi-label">${escapeHTML(label)}</p>
      </div>
      <p class="kpi-value tabular-nums">${value}</p>
      <p class="kpi-sub">${escapeHTML(sub)}</p>
      ${progressHTML}
    </div>
  `;
}

function prevStatsLabel(prev, stats) {
  if (stats.recaudado === 0 && prev.recaudado === 0) return 'Sin datos';
  return 'Comparado con el período anterior';
}

function compareBlock(label, current, previous, delta, isPercent = false) {
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const positive = delta > 0;
  const neutral  = delta === 0;
  const dotClass = neutral ? 'dot-neutral' : (isPercent ? (positive ? 'dot-success' : 'dot-danger') : 'dot-neutral');
  const deltaText = neutral ? 'sin cambios' : `${arrow} ${Math.abs(delta).toFixed(1)}${isPercent ? ' pts' : '%'}`;
  const deltaTone = neutral ? 'text-zinc-500' : positive ? 'text-success' : 'text-danger';
  return `
    <div class="border border-zinc-200 rounded-lg p-3.5">
      <p class="stat-label">${escapeHTML(label)}</p>
      <p class="stat-value text-xl mt-1">${current}</p>
      <div class="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100">
        <span class="text-xs text-zinc-500">Anterior: <span class="tabular-nums font-medium text-zinc-700">${previous}</span></span>
        <span class="status">
          <span class="status-dot ${dotClass}"></span>
          <span class="text-xs font-medium ${deltaTone}">${escapeHTML(deltaText)}</span>
        </span>
      </div>
    </div>
  `;
}

function catRow(c) {
  const swatch = `<span class="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style="background:${escapeHTML(c.color)}"></span>`;
  return `
    <tr>
      <td class="font-medium">${swatch}${escapeHTML(c.name)}</td>
      <td class="text-right tabular-nums font-semibold">${formatMXN(c.paid)}</td>
      <td class="text-right tabular-nums text-zinc-600">${formatMXN(c.pending)}</td>
      <td class="text-right tabular-nums text-zinc-500 hidden sm:table-cell">${formatMXN(c.total)}</td>
      <td class="text-right">
        <span class="status">
          <span class="status-dot ${c.pct >= 70 ? 'dot-success' : c.pct >= 40 ? 'dot-warning' : 'dot-danger'}"></span>
          <span class="font-medium tabular-nums">${c.pct}%</span>
        </span>
      </td>
    </tr>
  `;
}

// ============ GRÁFICAS SVG ============ //

function barsChart(data) {
  // data: { labels: ['Ene',...], paid:[..], pending:[..], total, max }
  const W = 600, H = 280;
  const padL = 50, padR = 16, padT = 16, padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.labels.length;
  const gapRatio = 0.32;
  const barW = (plotW / n) * (1 - gapRatio);
  const stepX = plotW / n;
  const maxV = Math.max(1, data.max);
  const niceMax = niceCeil(maxV);
  const gridSteps = 4;

  const gridLines = [];
  const yLabels = [];
  for (let i = 0; i <= gridSteps; i++) {
    const v = (niceMax / gridSteps) * i;
    const y = padT + plotH - (v / niceMax) * plotH;
    gridLines.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#F4F4F5" stroke-width="1" />`);
    yLabels.push(`<text x="${padL - 8}" y="${y + 3}" text-anchor="end" font-size="10" fill="#71717A" font-family="Inter, sans-serif" class="tabular-nums">${escapeHTML(compactMoney(v))}</text>`);
  }

  const bars = data.labels.map((lab, i) => {
    const paid = data.paid[i];
    const pending = data.pending[i];
    const total = paid + pending;
    const x = padL + stepX * i + (stepX - barW) / 2;
    const paidH = total > 0 ? (paid / niceMax) * plotH : 0;
    const pendingH = total > 0 ? (pending / niceMax) * plotH : 0;
    const yBase = padT + plotH;
    const yPaidTop = yBase - paidH;
    const yPendingTop = yPaidTop - pendingH;
    const hasData = total > 0;
    return `
      <g class="stat-bar" data-label="${escapeHTML(lab)}" data-paid="${paid}" data-pending="${pending}" data-total="${total}" style="cursor:pointer;">
        ${hasData ? `
          ${pending > 0 ? `<rect x="${x}" y="${yPendingTop}" width="${barW}" height="${Math.max(pendingH, 0.5)}" fill="#E4E4E7" rx="2" />` : ''}
          ${paid > 0 ? `<rect x="${x}" y="${yPaidTop}" width="${barW}" height="${Math.max(paidH, 0.5)}" fill="#09090B" rx="2" />` : ''}
        ` : `
          <rect x="${x}" y="${yBase - 2}" width="${barW}" height="2" fill="#E4E4E7" rx="1" />
        `}
        <rect class="stat-bar-hit" x="${padL + stepX * i}" y="${padT}" width="${stepX}" height="${plotH}" fill="transparent" />
      </g>
    `;
  }).join('');

  const xLabels = data.labels.map((lab, i) => {
    const x = padL + stepX * i + stepX / 2;
    return `<text x="${x}" y="${H - padB + 18}" text-anchor="middle" font-size="10" fill="#71717A" font-family="Inter, sans-serif">${escapeHTML(lab)}</text>`;
  }).join('');

  return `
    <div class="chart-wrap" data-chart="stats-bars">
      <div class="w-full overflow-x-auto">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de barras apiladas: recaudación vs pendiente por mes" class="w-full h-auto" style="min-width: 480px;">
          ${gridLines.join('')}
          ${yLabels.join('')}
          ${bars}
          ${xLabels}
        </svg>
      </div>
      <div class="chart-tooltip" role="tooltip" aria-hidden="true"></div>
    </div>
  `;
}

function linesChart(data) {
  const W = 600, H = 280;
  const padL = 44, padR = 16, padT = 16, padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.values.length;
  const stepX = plotW / (n - 1 || 1);
  const minV = 0, maxV = 100;

  const gridSteps = 4;
  const gridLines = [];
  const yLabels = [];
  for (let i = 0; i <= gridSteps; i++) {
    const v = (maxV / gridSteps) * i;
    const y = padT + plotH - (v / maxV) * plotH;
    gridLines.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#F4F4F5" stroke-width="1" />`);
    yLabels.push(`<text x="${padL - 8}" y="${y + 3}" text-anchor="end" font-size="10" fill="#71717A" font-family="Inter, sans-serif">${v}%</text>`);
  }

  const points = data.values.map((v, i) => {
    const x = padL + stepX * i;
    const y = padT + plotH - (v / maxV) * plotH;
    return { x, y, v, lab: data.labels[i], total: data.totals[i] };
  });

  const avg = data.avg;
  const avgY = padT + plotH - (avg / maxV) * plotH;
  const avgLine = `
    <line x1="${padL}" y1="${avgY}" x2="${W - padR}" y2="${avgY}"
          stroke="#A1A1AA" stroke-width="1" stroke-dasharray="3 3" />
    <text x="${W - padR - 4}" y="${avgY - 4}" text-anchor="end" font-size="10" fill="#71717A" font-family="Inter, sans-serif">Promedio ${avg}%</text>
  `;

  // Polyline + área sombreada
  const baselineY = padT + plotH;
  const areaPath = `M ${padL},${baselineY} ` + points.map((p) => `L ${p.x},${p.y}`).join(' ') + ` L ${padL + stepX * (n - 1)},${baselineY} Z`;
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  const dots = points.map((p) => `
    <g class="stat-dot" data-label="${escapeHTML(p.lab)}" data-value="${p.v}" data-total="${p.total}" style="cursor:pointer;">
      <circle cx="${p.x}" cy="${p.y}" r="14" fill="transparent" />
      <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="white" stroke="#09090B" stroke-width="1.75" />
    </g>
  `).join('');

  const allZero = data.values.every((v) => v === 0);
  const emptyMsg = allZero
    ? `<text x="${W / 2}" y="${padT + plotH / 2 + 4}" text-anchor="middle" font-size="11" fill="#A1A1AA" font-family="Inter, sans-serif">Sin pagos en ${_filter.year}</text>`
    : '';

  const xLabels = data.labels.map((lab, i) => {
    const x = padL + stepX * i;
    return `<text x="${x}" y="${H - padB + 18}" text-anchor="middle" font-size="10" fill="#71717A" font-family="Inter, sans-serif">${escapeHTML(lab)}</text>`;
  }).join('');

  return `
    <div class="chart-wrap" data-chart="stats-lines">
      <div class="w-full overflow-x-auto">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de líneas: porcentaje cobrado por mes" class="w-full h-auto" style="min-width: 480px;">
          <defs>
            <linearGradient id="lineAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#09090B" stop-opacity="0.18"/>
              <stop offset="100%" stop-color="#09090B" stop-opacity="0"/>
            </linearGradient>
          </defs>
          ${gridLines.join('')}
          ${yLabels.join('')}
          <path d="${areaPath}" fill="url(#lineAreaFill)" />
          <polyline points="${polyline}" fill="none" stroke="#09090B" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" />
          ${avgLine}
          ${dots}
          ${emptyMsg}
          ${xLabels}
        </svg>
      </div>
      <div class="chart-tooltip" role="tooltip" aria-hidden="true"></div>
    </div>
  `;
}

// Paleta consistente con la asignación de avatar por categoría
const CATEGORY_PALETTE = [
  '#F26B1F', '#27272A', '#1E3A5F', '#7C3AED', '#10B981',
  '#0EA5E9', '#EAB308', '#EC4899', '#84CC16', '#F43F5E',
];

function pickCategoryColor(name, usedSet) {
  // Mismo criterio estable que avatarGradient (orden alfabético)
  const cats = state.categories.map((c) => c.name).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  const baseIdx = Math.max(0, cats.indexOf(name)) % CATEGORY_PALETTE.length;
  if (!usedSet.has(baseIdx)) return CATEGORY_PALETTE[baseIdx];
  for (let i = 1; i < CATEGORY_PALETTE.length; i++) {
    const cand = (baseIdx + i) % CATEGORY_PALETTE.length;
    if (!usedSet.has(cand)) return CATEGORY_PALETTE[cand];
  }
  return CATEGORY_PALETTE[baseIdx];
}

function donutChart(donut) {
  const size = 220;
  const cx = size / 2, cy = size / 2;
  const r  = 90;
  const stroke = 22;
  const C = 2 * Math.PI * r;

  if (donut.total === 0) {
    return `<p class="text-sm text-zinc-500 py-6 text-center">Sin datos para graficar.</p>`;
  }

  let offset = 0;
  const segments = donut.segments.map((s) => {
    const frac = s.paid / donut.total;
    const dash = frac * C;
    const gap  = C - dash;
    const path = `
      <circle class="donut-seg" cx="${cx}" cy="${cy}" r="${r}"
              fill="none" stroke="${escapeHTML(s.color)}" stroke-width="${stroke}"
              stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset}"
              transform="rotate(-90 ${cx} ${cy})"
              data-name="${escapeHTML(s.name)}" data-paid="${s.paid}" data-pending="${s.pending}" data-total="${s.total}" data-pct="${s.pct}"
              style="cursor:pointer; transition: opacity 120ms;" />
    `;
    offset += dash;
    return path;
  }).join('');

  // Center label: total recaudado + % global
  const centerHTML = `
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="11" fill="#71717A" font-family="Inter, sans-serif">Recaudado</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="20" font-weight="700" fill="#09090B" font-family="Inter, sans-serif" class="tabular-nums">${escapeHTML(formatMXN(donut.recaudado))}</text>
    <text x="${cx}" y="${cy + 32}" text-anchor="middle" font-size="10.5" fill="#71717A" font-family="Inter, sans-serif" class="tabular-nums">${donut.totalCategorias} categoría${donut.totalCategorias === 1 ? '' : 's'}</text>
  `;

  // Leyenda
  const legend = donut.segments.map((s) => `
    <li class="flex items-center justify-between gap-3 py-1.5 border-b border-zinc-100 last:border-0">
      <span class="flex items-center gap-2 min-w-0">
        <span class="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style="background:${escapeHTML(s.color)}"></span>
        <span class="text-sm text-zinc-700 truncate">${escapeHTML(s.name)}</span>
      </span>
      <span class="text-xs text-zinc-500 tabular-nums shrink-0">${s.sharePct}%</span>
    </li>
  `).join('');

  return `
    <div class="chart-wrap" data-chart="stats-donut">
      <div class="flex flex-col items-center gap-3">
        <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Distribución de cobranza por categoría" class="w-full max-w-[240px]">
          <!-- Track -->
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F4F4F5" stroke-width="${stroke}" />
          ${segments}
          ${centerHTML}
        </svg>
        <ul class="w-full self-stretch">${legend}</ul>
      </div>
      <div class="chart-tooltip" role="tooltip" aria-hidden="true"></div>
    </div>
  `;
}

// ============ TOOLTIPS DE GRÁFICAS ============ //

function wireStatsTooltip(root) {
  root.querySelectorAll('.chart-wrap').forEach((wrap) => {
    const tip = wrap.querySelector('.chart-tooltip');
    if (!tip) return;
    const chartKind = wrap.dataset.chart;

    if (chartKind === 'stats-bars') {
      wrap.querySelectorAll('[data-label]').forEach((node) => {
        node.addEventListener('mouseenter', () => {
          const label = node.dataset.label;
          const paid = Number(node.dataset.paid);
          const pending = Number(node.dataset.pending);
          const total = Number(node.dataset.total);
          const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
          tip.innerHTML = `
            <p class="tt-title">${escapeHTML(label)}</p>
            <div class="tt-rows">
              <div class="tt-row"><span class="tt-label">Recaudado</span><span class="tt-val tabular-nums">${escapeHTML(formatMXN(paid))}</span></div>
              <div class="tt-row"><span class="tt-label">Pendiente</span><span class="tt-val tabular-nums text-zinc-500">${escapeHTML(formatMXN(pending))}</span></div>
              <div class="tt-row tt-row--accent"><span class="tt-label">% Cobrado</span><span class="tt-val tabular-nums">${pct}%</span></div>
            </div>
          `;
          tip.classList.add('is-visible');
        });
        node.addEventListener('mousemove', (e) => positionTooltip(e, wrap, tip));
        node.addEventListener('mouseleave', () => tip.classList.remove('is-visible'));
      });
    }

    if (chartKind === 'stats-lines') {
      wrap.querySelectorAll('[data-label]').forEach((node) => {
        node.addEventListener('mouseenter', () => {
          const label = node.dataset.label;
          const value = node.dataset.value;
          const total = Number(node.dataset.total);
          tip.innerHTML = `
            <p class="tt-title">${escapeHTML(label)}</p>
            <div class="tt-rows">
              <div class="tt-row tt-row--accent"><span class="tt-label">% Cobrado</span><span class="tt-val tabular-nums">${value}%</span></div>
              <div class="tt-row"><span class="tt-label">Pagos</span><span class="tt-val tabular-nums text-zinc-500">${escapeHTML(formatMXN(total))}</span></div>
            </div>
          `;
          tip.classList.add('is-visible');
        });
        node.addEventListener('mousemove', (e) => positionTooltip(e, wrap, tip));
        node.addEventListener('mouseleave', () => tip.classList.remove('is-visible'));
      });
    }

    if (chartKind === 'stats-donut') {
      const segs = wrap.querySelectorAll('.donut-seg');
      segs.forEach((node) => {
        node.addEventListener('mouseenter', () => {
          const name = node.dataset.name;
          const paid = Number(node.dataset.paid);
          const pending = Number(node.dataset.pending);
          const total = Number(node.dataset.total);
          const pct = Number(node.dataset.pct);
          tip.innerHTML = `
            <p class="tt-title">${escapeHTML(name)}</p>
            <div class="tt-rows">
              <div class="tt-row"><span class="tt-label">Recaudado</span><span class="tt-val tabular-nums">${escapeHTML(formatMXN(paid))}</span></div>
              <div class="tt-row"><span class="tt-label">Pendiente</span><span class="tt-val tabular-nums text-zinc-500">${escapeHTML(formatMXN(pending))}</span></div>
              <div class="tt-row"><span class="tt-label">Total</span><span class="tt-val tabular-nums text-zinc-500">${escapeHTML(formatMXN(total))}</span></div>
              <div class="tt-row tt-row--accent"><span class="tt-label">% Cobrado</span><span class="tt-val tabular-nums">${pct}%</span></div>
            </div>
          `;
          tip.classList.add('is-visible');
          segs.forEach((s) => { if (s !== node) s.style.opacity = '0.45'; });
        });
        node.addEventListener('mousemove', (e) => positionTooltip(e, wrap, tip));
        node.addEventListener('mouseleave', () => {
          tip.classList.remove('is-visible');
          segs.forEach((s) => { s.style.opacity = '1'; });
        });
      });
    }
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

// ============ CALCULOS ============ //

function availableYears() {
  const years = new Set([new Date().getFullYear(), ...state.payments.map((p) => Number(p.year))]);
  return [...years].sort((a, b) => b - a);
}

function filterPayments(f) {
  return state.payments.filter((p) => {
    if (Number(p.year) !== f.year) return false;
    if (f.month !== 'all' && Number(p.month) !== Number(f.month)) return false;
    return true;
  });
}

function computeStats(f) {
  const pays = filterPayments(f);
  const recaudado  = pays.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendiente  = pays.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);
  const cobradoPagos  = pays.filter((p) => p.status === 'paid').length;
  const pendientePagos = pays.filter((p) => p.status === 'pending').length;
  const totalPagos = pays.length;
  const totalEsperado = recaudado + pendiente;
  const cobradoPct = totalEsperado > 0 ? Math.round((recaudado / totalEsperado) * 100) : 0;
  const jugadoresUnicos = new Set(pays.map((p) => p.playerId)).size;
  return { recaudado, pendiente, totalEsperado, cobradoPagos, pendientePagos, totalPagos, cobradoPct, jugadoresUnicos };
}

function computePrevious(f) {
  if (f.month === 'all') {
    const prevY = f.year - 1;
    const prevFilter = { year: prevY, month: 'all' };
    return { filter: prevFilter, ...computeStats(prevFilter) };
  }
  let prevY = f.year;
  let prevM = Number(f.month) - 1;
  if (prevM < 1) { prevM = 12; prevY -= 1; }
  const prevFilter = { year: prevY, month: String(prevM) };
  return { filter: prevFilter, ...computeStats(prevFilter) };
}

function monthAggregate(year) {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const pays = state.payments.filter((p) =>
      Number(p.year) === year && Number(p.month) === month
    );
    const paid = pays.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
    const pending = pays.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);
    const total = paid + pending;
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { month, paid, pending, total, pct };
  });
}

function computeBarData(f) {
  const months = monthAggregate(f.year);
  const labels = months.map((m) => monthShort(m.month - 1));
  const paid = months.map((m) => m.paid);
  const pending = months.map((m) => m.pending);
  const total = months.reduce((s, m) => s + m.paid, 0);
  const max = Math.max(...paid.map((v, i) => v + pending[i]), 0);
  return { labels, paid, pending, total, max };
}

function computeLineData(f) {
  const months = monthAggregate(f.year);
  const labels = months.map((m) => monthShort(m.month - 1));
  const values = months.map((m) => m.pct);
  const totals = months.map((m) => m.total);
  const withData = months.filter((m) => m.total > 0).map((m) => m.pct);
  const avg = withData.length > 0
    ? Math.round(withData.reduce((s, v) => s + v, 0) / withData.length)
    : 0;
  return { labels, values, totals, avg, max: 100 };
}

function computeByCategory(f) {
  const pays = filterPayments(f);
  const cats = state.categories;
  const used = new Set();
  return cats.map((c) => {
    const inCat = state.players.filter((p) => p.category === c.name).map((p) => p.id);
    const inSet = new Set(inCat);
    const relevant = pays.filter((p) => inSet.has(p.playerId));
    const paid    = relevant.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
    const pending = relevant.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);
    const total = paid + pending;
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
    const color = pickCategoryColor(c.name, used);
    used.add(CATEGORY_PALETTE.indexOf(color));
    return { name: c.name, paid, pending, total, pct, color };
  }).filter((c) => c.total > 0);
}

function computeCategoryShare(byCategory, stats) {
  if (byCategory.length === 0) {
    return { segments: [], total: 0, recaudado: 0, totalCategorias: 0 };
  }
  const total = byCategory.reduce((s, c) => s + c.paid, 0);
  const segments = byCategory.map((c) => ({
    name: c.name,
    paid: c.paid,
    pending: c.pending,
    total: c.total,
    pct: c.pct,
    color: c.color,
    sharePct: total > 0 ? Math.round((c.paid / total) * 100) : 0,
  }));
  return {
    segments,
    total,
    recaudado: total,
    totalCategorias: byCategory.length,
  };
}

function deltaPct(current, previous) {
  if (!previous || previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function periodLabel(f) {
  const y = f.year;
  if (f.month === 'all') return `Todo ${y}`;
  return `${monthName(Number(f.month) - 1)} ${y}`;
}

// Helpers
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