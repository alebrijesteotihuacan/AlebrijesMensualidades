// js/views/stats.js
// Vista Estadísticas: KPIs por período, comparación con período anterior,
// gráficas mensuales. Cálculo correcto: esperado = suma de mensualidades.

import { state, escapeHTML, amountForPlayer } from '../app.js';
import { formatMXN, monthName, monthShort } from '../utils/dates.js';

let _filter = null; // { year, month ('all'|1..12) }

const BRAND = '#F26B1F';

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
  const bars      = computeBarData(_filter);
  const lines     = computeLineData(_filter);
  const byCategory = computeByCategory(_filter);
  const donut     = computeCategoryShare(byCategory);

  const today = new Date();
  const currentMonthIdx = (_filter.year === today.getFullYear()) ? today.getMonth() : -1;

  root.innerHTML = `
    <section class="flex flex-col gap-6">
      <!-- HEADER -->
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

      <!-- FILTROS -->
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

      <!-- KPIs DEL PERÍODO (4 stat blocks con delta) -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-5">
          <div>
            <p class="section-eyebrow">Período seleccionado</p>
            <h2 class="text-base font-semibold mt-1">${escapeHTML(periodLabel(_filter))}</h2>
          </div>
          <span class="status"><span class="status-dot dot-neutral"></span><span class="tabular-nums">${stats.jugadoresActivos} jugador${stats.jugadoresActivos === 1 ? '' : 'es'} activo${stats.jugadoresActivos === 1 ? '' : 's'}</span></span>
        </div>
        <div class="kpi-grid">
          ${statBlock({
            label: 'Recaudado',
            value: formatMXN(stats.recaudado),
            sub: `${stats.cobradoPct}% del esperado · ${formatMXN(stats.esperado)} esperado`,
            delta: deltaInfo(stats.recaudado, prev.recaudado, false),
            tone: 'success',
          })}
          ${statBlock({
            label: 'Pendiente',
            value: formatMXN(stats.pendiente),
            sub: `${stats.pendientePagos} pago${stats.pendientePagos === 1 ? '' : 's'} sin completar`,
            delta: deltaInfo(stats.pendiente, prev.pendiente, false, true),
            tone: 'warning',
          })}
          ${statBlock({
            label: '% Cobrado',
            value: `${stats.cobradoPct}%`,
            sub: `${stats.cobradoPagos} de ${stats.totalPagos} pago${stats.totalPagos === 1 ? '' : 's'}`,
            delta: deltaInfo(stats.cobradoPct, prev.cobradoPct, true, true),
            tone: stats.cobradoPct >= 70 ? 'success' : stats.cobradoPct >= 40 ? 'warning' : 'danger',
            bigValue: true,
          })}
          ${statBlock({
            label: 'Esperado',
            value: formatMXN(stats.esperado),
            sub: `${stats.jugadoresActivos} jugador${stats.jugadoresActivos === 1 ? '' : 'es'} × ${formatMXN(stats.promedioMensual)} promedio`,
            delta: null,
            tone: 'neutral',
          })}
        </div>
      </div>

      <!-- TENDENCIA MENSUAL: barras por mes -->
      <div class="card card-pad">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
          <div>
            <p class="section-eyebrow">Tendencia mensual</p>
            <h2 class="text-base font-semibold mt-1">Recaudación por mes · ${_filter.year}</h2>
          </div>
          <div class="flex items-center gap-3 text-xs">
            <span class="inline-flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-sm" style="background:${BRAND}"></span>Recaudado</span>
            <span class="inline-flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-sm" style="background:#E4E4E7"></span>Pendiente</span>
          </div>
        </div>
        ${barsChart(bars, currentMonthIdx)}
        <div class="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500">
          <span>Total anual recaudado: <strong class="text-zinc-900 tabular-nums">${formatMXN(bars.totalPaid)}</strong></span>
          <span>Total anual esperado: <strong class="text-zinc-900 tabular-nums">${formatMXN(bars.totalExpected)}</strong></span>
          <span>Pico: <strong class="text-zinc-900">${escapeHTML(bars.labels[bars.peakIdx] || '—')}</strong> · <span class="tabular-nums">${formatMXN(bars.peakVal)}</span></span>
        </div>
      </div>

      <!-- EVOLUCIÓN: % cobrado por mes -->
      <div class="card card-pad">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
          <div>
            <p class="section-eyebrow">Evolución</p>
            <h2 class="text-base font-semibold mt-1">% Cobrado por mes · ${_filter.year}</h2>
          </div>
          <div class="flex items-center gap-3 text-xs text-zinc-500 tabular-nums">
            <span>Esperado mensual: <strong class="text-zinc-900">${formatMXN(lines.expectedMonthly)}</strong></span>
            <span>·</span>
            <span>Promedio: <strong class="text-zinc-900">${lines.avg}%</strong></span>
          </div>
        </div>
        ${linesChart(lines, currentMonthIdx)}
        <div class="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500">
          <span>Mínimo: <strong class="text-zinc-900 tabular-nums">${lines.min}%</strong></span>
          <span>Máximo: <strong class="text-zinc-900 tabular-nums">${lines.max}%</strong></span>
          <span>Actual: <strong class="text-zinc-900 tabular-nums">${currentMonthIdx >= 0 && lines.values[currentMonthIdx] != null ? lines.values[currentMonthIdx] + '%' : '—'}</strong></span>
        </div>
      </div>

      <!-- COBRANZA POR CATEGORÍA: tabla + donut -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="section-eyebrow">Por categoría</p>
            <h2 class="text-base font-semibold mt-1">Cobranza del período</h2>
          </div>
          <span class="text-xs text-zinc-500 tabular-nums">${byCategory.length} categoría${byCategory.length === 1 ? '' : 's'}</span>
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
                        <th class="text-right hidden sm:table-cell">Esperado</th>
                        <th class="text-right">%</th>
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

  wireStatsTooltip(root);
}

// ============ HELPERS ============ //

/** Info de delta: flecha + porcentaje + texto del período comparado */
function deltaInfo(current, previous, isPercent = false, lowerIsBetter = false) {
  if (previous === 0 && current === 0) {
    return { text: 'Sin datos', tone: 'neutral', arrow: '→' };
  }
  if (previous === 0) {
    return { text: 'nuevo', tone: 'neutral', arrow: '↑' };
  }
  const delta = current - previous;
  if (delta === 0) {
    return { text: 'sin cambios', tone: 'neutral', arrow: '→' };
  }
  const arrow = delta > 0 ? '↑' : '↓';
  const positive = delta > 0;
  // lowerIsBetter: para "pendiente", bajar es bueno
  const good = lowerIsBetter ? !positive : positive;
  const tone = good ? 'success' : 'danger';
  const abs = Math.abs(delta).toFixed(1);
  return { text: `${abs}${isPercent ? ' pts' : '%'}`, tone, arrow };
}

// ============ COMPONENTES UI ============ //

function statBlock({ label, value, sub, delta, tone, bigValue }) {
  const dotClass = tone === 'success' ? 'dot-success' : tone === 'warning' ? 'dot-warning' : tone === 'danger' ? 'dot-danger' : 'dot-neutral';
  const accentColor = tone === 'success' ? '#10B981' : tone === 'warning' ? '#F59E0B' : tone === 'danger' ? '#EF4444' : '#52525B';
  const deltaBg = delta && delta.tone === 'success' ? '#ECFDF5' : delta && delta.tone === 'danger' ? '#FEF2F2' : '#F4F4F5';
  const deltaTextClass = delta && delta.tone === 'success' ? 'text-emerald-700' : delta && delta.tone === 'danger' ? 'text-red-700' : 'text-zinc-600';
  const deltaHTML = delta ? `
    <span class="kpi-delta-pill" style="background: ${deltaBg}">
      <span class="${deltaTextClass}">${delta.arrow}</span>
      <span class="tabular-nums ${deltaTextClass}">${escapeHTML(delta.text)}</span>
      <span class="text-zinc-400 font-normal text-[10.5px]">vs anterior</span>
    </span>
  ` : '';
  return `
    <div class="kpi-block">
      <div class="kpi-accent" style="background: ${accentColor}"></div>
      <div class="kpi-head">
        <span class="status-dot ${dotClass}"></span>
        <p class="stat-label">${escapeHTML(label)}</p>
      </div>
      <p class="stat-value ${bigValue ? 'text-3xl sm:text-4xl' : ''} mt-1">${value}</p>
      <p class="stat-sub">${escapeHTML(sub)}</p>
      ${deltaHTML}
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
      <td class="text-right tabular-nums text-zinc-500 hidden sm:table-cell">${formatMXN(c.expected)}</td>
      <td class="text-right">
        <span class="status">
          <span class="status-dot ${c.pct >= 70 ? 'dot-success' : c.pct >= 40 ? 'dot-warning' : 'dot-danger'}"></span>
          <span class="font-medium tabular-nums">${c.pct}%</span>
        </span>
      </td>
    </tr>
  `;
}

// ============ BARS CHART (Tendencia Mensual) ============ //

function barsChart(data, currentMonthIdx) {
  // data: { labels, paid, pending, totalPaid, totalExpected, peakIdx, peakVal, year }
  const W = 600, H = 320;
  const padL = 56, padR = 24, padT = 32, padB = 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.labels.length;
  const gapRatio = 0.36;
  const barW = (plotW / n) * (1 - gapRatio);
  const stepX = plotW / n;
  const maxV = Math.max(1, Math.max(...data.paid.map((v, i) => v + data.pending[i])));
  const niceMax = niceCeil(maxV);
  const baselineY = padT + plotH;

  const gridLines = [];
  const yLabels = [];
  for (let i = 0; i <= 4; i++) {
    const v = (niceMax / 4) * i;
    const y = baselineY - (v / niceMax) * plotH;
    const isZero = i === 0;
    gridLines.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${isZero ? '#E4E4E7' : '#F4F4F5'}" stroke-width="1" ${isZero ? '' : 'stroke-dasharray="2 4"'} />`);
    yLabels.push(`<text x="${padL - 10}" y="${y + 3.5}" text-anchor="end" font-size="10.5" fill="#A1A1AA" font-family="Inter, sans-serif" class="tabular-nums">${escapeHTML(compactMoney(v))}</text>`);
  }

  const bars = data.labels.map((lab, i) => {
    const paid = data.paid[i];
    const pending = data.pending[i];
    const total = paid + pending;
    const x = padL + stepX * i + (stepX - barW) / 2;
    const paidH = total > 0 ? (paid / niceMax) * plotH : 0;
    const pendingH = total > 0 ? (pending / niceMax) * plotH : 0;
    const yPaidTop = baselineY - paidH;
    const yPendingTop = yPaidTop - pendingH;
    const hasData = total > 0;
    const isCurrent = i === currentMonthIdx;

    const r = Math.min(3, Math.max(2, barW / 5));
    const topPath = (x0, y0, h) => {
      if (h <= 0) return '';
      const rr = Math.min(r, h / 2);
      return `M ${x0},${y0 + h} L ${x0},${y0 + rr} Q ${x0},${y0} ${x0 + rr},${y0} L ${x0 + w - rr},${y0} Q ${x0 + w},${y0} ${x0 + w},${y0 + rr} L ${x0 + w},${y0 + h} Z`;
    };
    function topPathReal(x0, y0, h, w) {
      if (h <= 0) return '';
      const rr = Math.min(r, h / 2);
      return `M ${x0},${y0 + h} L ${x0},${y0 + rr} Q ${x0},${y0} ${x0 + rr},${y0} L ${x0 + w - rr},${y0} Q ${x0 + w},${y0} ${x0 + w},${y0 + rr} L ${x0 + w},${y0 + h} Z`;
    }

    const currentBg = isCurrent
      ? `<rect x="${padL + stepX * i + 1}" y="${padT - 8}" width="${stepX - 2}" height="${plotH + 12}" rx="4" fill="#FAFAFA" />`
      : '';

    let paidEl = '';
    let pendingEl = '';
    if (paid > 0) {
      if (pending > 0) {
        paidEl = `<rect x="${x}" y="${yPaidTop}" width="${barW}" height="${Math.max(paidH, 1)}" fill="${BRAND}" />`;
      } else {
        paidEl = `<path d="${topPathReal(x, yPaidTop, paidH, barW)}" fill="${BRAND}" />`;
      }
    }
    if (pending > 0) {
      pendingEl = `<path d="${topPathReal(x, yPendingTop, pendingH, barW)}" fill="#E4E4E7" />`;
    }

    return `
      ${currentBg}
      <g class="stat-bar" data-label="${escapeHTML(lab)}" data-paid="${paid}" data-pending="${pending}" data-total="${total}" style="cursor:pointer;">
        ${hasData ? `
          ${pendingEl}
          ${paidEl}
        ` : `
          <rect x="${x}" y="${baselineY - 2}" width="${barW}" height="2" fill="#E4E4E7" rx="1" />
        `}
        <rect class="stat-bar-hit" x="${padL + stepX * i}" y="${padT - 12}" width="${stepX}" height="${plotH + 16}" fill="transparent" />
      </g>
    `;
  }).join('');

  const xLabels = data.labels.map((lab, i) => {
    const x = padL + stepX * i + stepX / 2;
    const isCurrent = i === currentMonthIdx;
    const fill = isCurrent ? '#09090B' : '#71717A';
    const weight = isCurrent ? '700' : '400';
    return `<text x="${x}" y="${H - padB + 22}" text-anchor="middle" font-size="11" fill="${fill}" font-weight="${weight}" font-family="Inter, sans-serif">${escapeHTML(lab)}</text>`;
  }).join('');

  return `
    <div class="chart-wrap" data-chart="stats-bars">
      <div class="w-full overflow-x-auto">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de barras: recaudación vs pendiente por mes" class="w-full h-auto chart-svg" style="min-width: 520px;">
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

// ============ LINES CHART (Evolución) ============ //

function linesChart(data, currentMonthIdx) {
  // data: { labels, values, totals, avg, min, max, minIdx, maxIdx, expectedMonthly }
  const W = 600, H = 320;
  const padL = 48, padR = 24, padT = 32, padB = 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.values.length;
  const stepX = plotW / Math.max(1, n - 1);
  const maxV = 100;
  const baselineY = padT + plotH;

  const points = data.values.map((v, i) => {
    const x = padL + stepX * i;
    const y = baselineY - (v / maxV) * plotH;
    return { x, y, v, lab: data.labels[i], total: data.totals[i] };
  });

  const gridLines = [];
  const yLabels = [];
  for (let i = 0; i <= 4; i++) {
    const v = (maxV / 4) * i;
    const y = baselineY - (v / maxV) * plotH;
    const isZero = i === 0;
    gridLines.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${isZero ? '#E4E4E7' : '#F4F4F5'}" stroke-width="1" ${isZero ? '' : 'stroke-dasharray="2 4"'} />`);
    yLabels.push(`<text x="${padL - 10}" y="${y + 3.5}" text-anchor="end" font-size="10.5" fill="#A1A1AA" font-family="Inter, sans-serif">${v}%</text>`);
  }

  // Línea promedio sutil (sin badge)
  const avg = data.avg;
  const avgY = baselineY - (avg / maxV) * plotH;

  // Smooth path + area
  const smooth = smoothPath(points);
  const curveTail = smooth.replace(/^M [^ ]+ /, '');
  const areaPath = `M ${points[0].x},${baselineY} L ${points[0].x},${points[0].y} ${curveTail} L ${points[n - 1].x},${baselineY} Z`;

  const allZero = data.values.every((v) => v === 0);
  const emptyMsg = allZero
    ? `<text x="${W / 2}" y="${padT + plotH / 2 + 4}" text-anchor="middle" font-size="11" fill="#A1A1AA" font-family="Inter, sans-serif">Sin pagos en ${_filter.year}</text>`
    : '';

  const xLabels = data.labels.map((lab, i) => {
    const x = padL + stepX * i;
    const isCurrent = i === currentMonthIdx;
    const fill = isCurrent ? '#09090B' : '#71717A';
    const weight = isCurrent ? '700' : '400';
    return `<text x="${x}" y="${H - padB + 22}" text-anchor="middle" font-size="11" fill="${fill}" font-weight="${weight}" font-family="Inter, sans-serif">${escapeHTML(lab)}</text>`;
  }).join('');

  const dots = points.map((p, i) => {
    const isCurrent = i === currentMonthIdx;
    const dotR = isCurrent ? 5 : 3.5;
    const strokeW = isCurrent ? 2.25 : 1.75;
    return `
      <g class="stat-dot" data-label="${escapeHTML(p.lab)}" data-value="${p.v}" data-total="${p.total}" style="cursor:pointer;">
        <circle cx="${p.x}" cy="${p.y}" r="${dotR + 6}" fill="transparent" />
        <circle cx="${p.x}" cy="${p.y}" r="${dotR}" fill="#FFFFFF" stroke="#09090B" stroke-width="${strokeW}" />
      </g>
    `;
  }).join('');

  // Etiqueta del promedio (texto pequeño)
  const avgLabelY = Math.max(padT + 8, Math.min(avgY, baselineY - 10));
  const avgLabel = `
    <g transform="translate(${padL + 8}, ${avgLabelY - 16})">
      <text x="0" y="13" font-size="10.5" font-weight="500" fill="#71717A" font-family="Inter, sans-serif">Promedio</text>
      <text x="56" y="13" font-size="11" font-weight="700" fill="#09090B" font-family="Inter, sans-serif" class="tabular-nums">${avg}%</text>
      <line x1="0" y1="20" x2="68" y2="20" stroke="${BRAND}" stroke-width="1.5" />
    </g>
  `;

  return `
    <div class="chart-wrap" data-chart="stats-lines">
      <div class="w-full overflow-x-auto">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de líneas: porcentaje cobrado por mes" class="w-full h-auto chart-svg" style="min-width: 520px;">
          <defs>
            <linearGradient id="lineAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#09090B" stop-opacity="0.18"/>
              <stop offset="100%" stop-color="#09090B" stop-opacity="0"/>
            </linearGradient>
            <clipPath id="lineChartClip">
              <!-- Clip area al chart, recortando justo en el 0% para que la curva
                   Catmull-Rom (que puede hacer overshoot) no se vea bajar de 0. -->
              <rect x="${padL - 1}" y="${padT - 2}" width="${plotW + 2}" height="${plotH + 2}" />
            </clipPath>
          </defs>
          ${gridLines.join('')}
          ${yLabels.join('')}
          <g clip-path="url(#lineChartClip)">
            <path d="${areaPath}" fill="url(#lineAreaFill)" />
            <path d="${smooth}" fill="none" stroke="#09090B" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          </g>
          <line x1="${padL}" y1="${avgY}" x2="${W - padR}" y2="${avgY}" stroke="${BRAND}" stroke-width="1" stroke-dasharray="3 4" opacity="0.55" />
          ${dots}
          ${avgLabel}
          ${emptyMsg}
          ${xLabels}
        </svg>
      </div>
      <div class="chart-tooltip" role="tooltip" aria-hidden="true"></div>
    </div>
  `;
}

// ============ DONUT CHART ============ //

function donutChart(donut) {
  const size = 220;
  const cx = size / 2, cy = size / 2;
  const r = 90;
  const stroke = 22;
  const C = 2 * Math.PI * r;

  if (donut.total === 0) {
    return `<p class="text-sm text-zinc-500 py-6 text-center">Sin datos para graficar.</p>`;
  }

  let offset = 0;
  const segments = donut.segments.map((s) => {
    const frac = s.paid / donut.total;
    const dash = frac * C;
    const gap = C - dash;
    const seg = `
      <circle class="donut-seg" cx="${cx}" cy="${cy}" r="${r}"
              fill="none" stroke="${escapeHTML(s.color)}" stroke-width="${stroke}"
              stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset}"
              transform="rotate(-90 ${cx} ${cy})"
              data-name="${escapeHTML(s.name)}" data-paid="${s.paid}" data-pending="${s.pending}" data-total="${s.total}" data-pct="${s.pct}"
              style="cursor:pointer; transition: opacity 120ms;" />
    `;
    offset += dash;
    return seg;
  }).join('');

  const centerHTML = `
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="11" fill="#71717A" font-family="Inter, sans-serif">Recaudado</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="20" font-weight="700" fill="#09090B" font-family="Inter, sans-serif" letter-spacing="-0.5" class="tabular-nums">${escapeHTML(formatMXN(donut.recaudado))}</text>
    <text x="${cx}" y="${cy + 32}" text-anchor="middle" font-size="10.5" fill="#71717A" font-family="Inter, sans-serif" class="tabular-nums">${donut.totalCategorias} categoría${donut.totalCategorias === 1 ? '' : 's'}</text>
  `;

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

// ============ CURVA SUAVIZADA ============ //

function smoothPath(points) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  const out = [`M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    out.push(`C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`);
  }
  return out.join(' ');
}

// ============ TOOLTIPS ============ //

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
              <div class="tt-row"><span class="tt-label">Recaudado</span><span class="tt-val tabular-nums text-zinc-500">${escapeHTML(formatMXN(total))}</span></div>
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
              <div class="tt-row"><span class="tt-label">Esperado</span><span class="tt-val tabular-nums text-zinc-500">${escapeHTML(formatMXN(total))}</span></div>
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

// ============ CÁLCULOS ============ //

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

/** Suma esperada del período: suma de mensualidades de jugadores no exentos.
 *  Coincide con la lógica del Dashboard. */
function expectedFor(f) {
  const monthsInRange = (f.month === 'all') ? 12 : 1;
  return state.players
    .filter((p) => !p.exempt)
    .reduce((s, p) => s + amountForPlayer(p) * monthsInRange, 0);
}

function expectedMonthly() {
  return state.players
    .filter((p) => !p.exempt)
    .reduce((s, p) => s + amountForPlayer(p), 0);
}

function computeStats(f) {
  const pays = filterPayments(f);
  const recaudado  = pays.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  const esperado   = expectedFor(f);
  const pendiente  = Math.max(0, esperado - recaudado);
  const cobradoPagos  = pays.filter((p) => p.status === 'paid').length;
  const pendientePagos = Math.max(0, state.players.filter((p) => !p.exempt).length - cobradoPagos);
  const totalPagos = cobradoPagos + pendientePagos;
  const cobradoPct = esperado > 0 ? Math.round((recaudado / esperado) * 100) : 0;
  const jugadoresActivos = state.players.filter((p) => !p.exempt).length;
  const promedioMensual = jugadoresActivos > 0 ? Math.round(esperado / (f.month === 'all' ? 12 : 1) / jugadoresActivos) : 0;
  return {
    recaudado, pendiente, esperado, cobradoPagos, pendientePagos, totalPagos,
    cobradoPct, jugadoresActivos, promedioMensual,
  };
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
  const expectedM = expectedMonthly();
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const pays = state.payments.filter((p) =>
      Number(p.year) === year && Number(p.month) === month
    );
    const paid = pays.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
    const pending = Math.max(0, expectedM - paid);
    const pct = expectedM > 0 ? Math.round((paid / expectedM) * 100) : 0;
    return { month, paid, pending, total: expectedM, pct };
  });
}

function computeBarData(f) {
  const months = monthAggregate(f.year);
  const labels = months.map((m) => monthShort(m.month - 1));
  const paid = months.map((m) => m.paid);
  const pending = months.map((m) => m.pending);
  const totalPaid = paid.reduce((s, v) => s + v, 0);
  const totalExpected = months[0]?.total || 0;
  const max = Math.max(...paid.map((v, i) => v + pending[i]), 0);
  const peakIdx = paid.indexOf(Math.max(...paid));
  const peakVal = peakIdx >= 0 ? paid[peakIdx] : 0;
  return { labels, paid, pending, totalPaid, totalExpected, max, peakIdx, peakVal };
}

function computeLineData(f) {
  const months = monthAggregate(f.year);
  const labels = months.map((m) => monthShort(m.month - 1));
  const values = months.map((m) => m.pct);
  const totals = months.map((m) => m.paid);
  const withData = months.filter((m) => m.total > 0).map((m) => m.pct);
  const avg = withData.length > 0
    ? Math.round(withData.reduce((s, v) => s + v, 0) / withData.length)
    : 0;
  const max = withData.length > 0 ? Math.max(...withData) : 0;
  const min = withData.length > 0 ? Math.min(...withData) : 0;
  const maxIdx = values.indexOf(max);
  const minIdx = values.indexOf(min);
  const expectedMonthly = months[0]?.total || 0;
  return { labels, values, totals, avg, max, min, maxIdx, minIdx, expectedMonthly };
}

function computeByCategory(f) {
  const pays = filterPayments(f);
  const cats = state.categories;
  const used = new Set();
  return cats.map((c) => {
    const inCat = state.players.filter((p) => p.category === c.name && !p.exempt);
    const inSet = new Set(inCat.map((p) => p.id));
    const relevant = pays.filter((p) => inSet.has(p.playerId));
    const paid    = relevant.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
    const expected = inCat.reduce((s, p) => s + amountForPlayer(p), 0);
    const pending = Math.max(0, expected - paid);
    const total = expected;
    const pct = expected > 0 ? Math.round((paid / expected) * 100) : 0;
    const color = pickCategoryColor(c.name, used);
    used.add(CATEGORY_PALETTE.indexOf(color));
    return { name: c.name, paid, pending, expected, total, pct, color };
  })
  .filter((c) => c.expected > 0)
  .sort((a, b) => b.paid - a.paid);
}

function computeCategoryShare(byCategory) {
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
  return { segments, total, recaudado: total, totalCategorias: byCategory.length };
}

// Paleta consistente con la asignación de avatar por categoría
const CATEGORY_PALETTE = [
  '#F26B1F', '#27272A', '#1E3A5F', '#7C3AED', '#10B981',
  '#0EA5E9', '#EAB308', '#EC4899', '#84CC16', '#F43F5E',
];

function pickCategoryColor(name, usedSet) {
  const cats = state.categories.map((c) => c.name).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  const baseIdx = Math.max(0, cats.indexOf(name)) % CATEGORY_PALETTE.length;
  if (!usedSet.has(baseIdx)) return CATEGORY_PALETTE[baseIdx];
  for (let i = 1; i < CATEGORY_PALETTE.length; i++) {
    const cand = (baseIdx + i) % CATEGORY_PALETTE.length;
    if (!usedSet.has(cand)) return CATEGORY_PALETTE[cand];
  }
  return CATEGORY_PALETTE[baseIdx];
}

function periodLabel(f) {
  const y = f.year;
  if (f.month === 'all') return `Todo ${y}`;
  return `${monthName(Number(f.month) - 1)} ${y}`;
}

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