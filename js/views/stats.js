// js/views/stats.js
// Vista Estadísticas: rediseño editorial con hero stat, bento de KPIs,
// gráficas con personalidad (anotaciones, banda de promedio, brand color).

import { state, escapeHTML } from '../app.js';
import { formatMXN, monthName, monthShort } from '../utils/dates.js';

let _filter = null; // { year, month ('all'|1..12) }

const BRAND = '#F26B1F';
const BRAND_DARK = '#C24D14';
const INK = '#09090B';

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
  const donut     = computeCategoryShare(byCategory, stats);
  const spark     = computeSparkData(_filter);

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
        <div class="flex items-center gap-2">
          <select id="s-month" class="select w-auto">
            <option value="all" ${_filter.month === 'all' ? 'selected' : ''}>Todo el año</option>
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => `<option value="${m}" ${_filter.month === String(m) ? 'selected' : ''}>${escapeHTML(monthName(m - 1))}</option>`).join('')}
          </select>
          <select id="s-year" class="select w-auto">
            ${availableYears().map((y) => `<option value="${y}" ${_filter.year === y ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
          <button id="reset-filter" type="button" class="btn btn-ghost btn-sm" title="Volver al período actual">
            <svg viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.1a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.277z" clip-rule="evenodd"/></svg>
          </button>
        </div>
      </header>

      <!-- HERO STAT: el dato más importante, con sparkline detrás -->
      <div class="hero-stat">
        <div class="hero-stat-bg" aria-hidden="true">
          ${sparklineBackground(spark)}
        </div>
        <div class="hero-stat-content">
          <p class="hero-eyebrow">
            <span class="status-dot dot-success"></span>
            Recaudado · ${escapeHTML(periodLabel(_filter))}
          </p>
          <p class="hero-number tabular-nums">${formatMXN(stats.recaudado)}</p>
          <div class="hero-meta">
            <div class="hero-meta-item">
              <span class="hero-meta-label">% del esperado</span>
              <span class="hero-meta-value tabular-nums">${stats.cobradoPct}%</span>
            </div>
            <span class="hero-meta-sep"></span>
            <div class="hero-meta-item">
              <span class="hero-meta-label">vs ${escapeHTML(periodLabel(prev.filter))}</span>
              <span class="hero-meta-value tabular-nums ${deltaToneClass(stats.recaudado, prev.recaudado, false)}">${deltaArrowText(stats.recaudado, prev.recaudado, false)}</span>
            </div>
            <span class="hero-meta-sep"></span>
            <div class="hero-meta-item">
              <span class="hero-meta-label">Pagos cobrados</span>
              <span class="hero-meta-value tabular-nums">${stats.cobradoPagos} / ${stats.totalPagos}</span>
            </div>
          </div>
          <div class="hero-progress" aria-hidden="true">
            <div class="hero-progress-bar" style="width: ${Math.min(100, stats.cobradoPct)}%"></div>
          </div>
        </div>
      </div>

      <!-- BENTO: 3 KPIs secundarios en grid asimétrico -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        ${bentoCard({
          label: 'Pendiente',
          value: formatMXN(stats.pendiente),
          sub: `${stats.pendientePagos} pago${stats.pendientePagos === 1 ? '' : 's'} sin completar`,
          tone: 'warning',
          delta: stats.pendiente,
          prev: prev.pendiente,
          large: false,
        })}
        ${bentoCard({
          label: '% Cobrado',
          value: `${stats.cobradoPct}%`,
          sub: `${stats.cobradoPagos} de ${stats.totalPagos} pago${stats.totalPagos === 1 ? '' : 's'}`,
          tone: stats.cobradoPct >= 70 ? 'success' : stats.cobradoPct >= 40 ? 'warning' : 'danger',
          delta: stats.cobradoPct,
          prev: prev.cobradoPct,
          isPercent: true,
          large: true,
        })}
        ${bentoCard({
          label: 'Jugadores activos',
          value: stats.jugadoresUnicos,
          sub: `con al menos un pago`,
          tone: 'neutral',
          large: false,
        })}
      </div>

      <!-- 2-COLUMN CHARTS: barras + línea lado a lado -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- TENDENCIA MENSUAL -->
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <p class="section-eyebrow">Tendencia mensual</p>
              <h2 class="chart-card-title">Recaudación por mes</h2>
            </div>
            <div class="chart-card-actions">
              <div class="legend-pill"><span class="legend-swatch" style="background:${BRAND}"></span>Recaudado</div>
              <div class="legend-pill"><span class="legend-swatch legend-swatch--muted"></span>Pendiente</div>
            </div>
          </div>
          ${barsChart(bars, currentMonthIdx)}
          <div class="chart-card-foot">
            <span>Total anual: <strong class="tabular-nums">${formatMXN(bars.total)}</strong></span>
            <span>Pico: <strong class="tabular-nums">${escapeHTML(bars.labels[bars.peakIdx])}</strong> · ${formatMXN(bars.peakVal)}</span>
          </div>
        </div>

        <!-- EVOLUCIÓN -->
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <p class="section-eyebrow">Evolución</p>
              <h2 class="chart-card-title">% Cobrado por mes</h2>
            </div>
            <div class="chart-card-actions">
              <div class="legend-pill"><span class="legend-dot dot-warning"></span>Promedio ${lines.avg}%</div>
            </div>
          </div>
          ${linesChart(lines, currentMonthIdx)}
          <div class="chart-card-foot">
            <span>Mínimo: <strong class="tabular-nums">${lines.min}%</strong></span>
            <span>Máximo: <strong class="tabular-nums">${lines.max}%</strong></span>
            <span>Actual: <strong class="tabular-nums">${currentMonthIdx >= 0 && lines.values[currentMonthIdx] ? lines.values[currentMonthIdx] + '%' : '—'}</strong></span>
          </div>
        </div>
      </div>

      <!-- COBRANZA POR CATEGORÍA: donut + tabla -->
      <div class="chart-card">
        <div class="chart-card-head">
          <div>
            <p class="section-eyebrow">Por categoría</p>
            <h2 class="chart-card-title">Cobranza del período</h2>
          </div>
          <span class="text-xs text-zinc-500 tabular-nums">${byCategory.length} categorías · ${formatMXN(donut.recaudado)} recaudado</span>
        </div>
        ${byCategory.length === 0
          ? `<p class="text-sm text-zinc-500 py-8 text-center">Sin categorías con pagos en este período.</p>`
          : `<div class="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
              <div class="lg:col-span-2 order-2 lg:order-1">
                ${donutChart(donut)}
              </div>
              <div class="lg:col-span-3 order-1 lg:order-2">
                <div class="table-wrap overflow-x-auto">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Categoría</th>
                        <th class="text-right">Recaudado</th>
                        <th class="text-right">Pendiente</th>
                        <th class="text-right hidden sm:table-cell">Total</th>
                        <th class="text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${byCategory.map((c, i) => catRow(c, i, donut.segments[0]?.name)).join('')}
                    </tbody>
                  </table>
                </div>
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

// ============ HELPERS DE FORMATO ============ //

function deltaArrowText(current, previous, isPercent = false) {
  if (!previous && current === 0) return '—';
  const delta = current - previous;
  if (delta === 0) return 'sin cambios';
  const arrow = delta > 0 ? '↑' : '↓';
  const abs = Math.abs(delta).toFixed(1);
  return `${arrow} ${abs}${isPercent ? ' pts' : '%'}`;
}

function deltaToneClass(current, previous, isPercent = false) {
  if (!previous && current === 0) return 'text-zinc-500';
  const delta = current - previous;
  if (delta === 0) return 'text-zinc-500';
  // Para métricas donde "más es mejor" (recaudado, cobrado)
  const positive = delta > 0;
  if (isPercent) {
    return positive ? 'text-success' : 'text-danger';
  }
  return positive ? 'text-success' : 'text-danger';
}

// ============ COMPONENTES UI ============ //

function bentoCard({ label, value, sub, tone, delta, prev, isPercent, large }) {
  const toneColor = tone === 'success' ? '#047857' : tone === 'warning' ? '#B45309' : tone === 'danger' ? '#B91C1C' : '#27272A';
  const bgColor   = tone === 'success' ? '#ECFDF5' : tone === 'warning' ? '#FFFBEB' : tone === 'danger' ? '#FEF2F2' : '#F4F4F5';
  const dotClass  = tone === 'success' ? 'dot-success' : tone === 'warning' ? 'dot-warning' : tone === 'danger' ? 'dot-danger' : 'dot-neutral';

  const deltaHTML = (delta !== undefined && prev !== undefined)
    ? `<span class="bento-delta tabular-nums ${deltaToneClass(delta, prev, isPercent)}">${deltaArrowText(delta, prev, isPercent)}</span>`
    : '';

  return `
    <div class="bento-card ${large ? 'bento-card--large' : ''}" style="--bento-accent:${toneColor}; --bento-bg:${bgColor};">
      <div class="bento-card-head">
        <span class="status-dot ${dotClass}"></span>
        <p class="bento-label">${escapeHTML(label)}</p>
      </div>
      <p class="bento-value tabular-nums">${value}</p>
      <div class="bento-card-foot">
        <p class="bento-sub">${escapeHTML(sub)}</p>
        ${deltaHTML}
      </div>
    </div>
  `;
}

function catRow(c, idx, topName) {
  const rank = idx + 1;
  const isTop = c.name === topName && idx === 0;
  const swatch = `<span class="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style="background:${escapeHTML(c.color)}"></span>`;
  return `
    <tr class="${isTop ? 'cat-row--top' : ''}">
      <td class="font-medium">
        <span class="cat-rank">${rank}</span>
        ${swatch}${escapeHTML(c.name)}
      </td>
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

// ============ SPARKLINE (background del hero) ============ //

function sparklineBackground(data) {
  if (!data || data.values.length === 0 || data.max === 0) return '';
  const W = 600, H = 200;
  const pad = 8;
  const plotW = W - pad * 2;
  const plotH = H - pad * 2;
  const n = data.values.length;
  const stepX = plotW / Math.max(1, n - 1);
  const maxV = Math.max(1, data.max);
  const points = data.values.map((v, i) => ({
    x: pad + stepX * i,
    y: pad + plotH - (v / maxV) * plotH,
  }));
  const smooth = smoothPath(points);
  const baselineY = pad + plotH;
  const areaPath = `M ${points[0].x},${baselineY} L ${points[0].x},${points[0].y} ${smooth.replace(/^M [^ ]+ /, '')} L ${points[n - 1].x},${baselineY} Z`;
  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="hero-spark-svg" aria-hidden="true">
      <defs>
        <linearGradient id="heroSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${BRAND}" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="${BRAND}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#heroSparkFill)" />
      <path d="${smooth}" fill="none" stroke="${BRAND}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
  `;
}

// ============ BARS CHART (Tendencia Mensual) ============ //

function barsChart(data, currentMonthIdx) {
  // data: { labels, paid, pending, total, max, peakIdx, peakVal }
  const W = 640, H = 360;
  const padL = 52, padR = 20, padT = 56, padB = 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.labels.length;
  const gapRatio = 0.36;
  const barW = (plotW / n) * (1 - gapRatio);
  const stepX = plotW / n;
  const maxV = Math.max(1, data.max);
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

  // Watermark: año como fondo sutil
  const watermark = `
    <text x="${W - padR}" y="${padT - 18}" text-anchor="end" font-size="42" font-weight="700" fill="#F4F4F5" font-family="Inter, sans-serif" letter-spacing="-2" aria-hidden="true">${escapeHTML(String(data.year || ''))}</text>
  `;

  const bars = data.labels.map((lab, i) => {
    const paid = data.paid[i];
    const pending = data.pending[i];
    const total = paid + pending;
    const x = padL + stepX * i + (stepX - barW) / 2;
    const paidH = total > 0 ? (paid / niceMax) * plotH : 0;
    const pendingH = total > 0 ? (pending / niceMax) * plotH : 0;
    const yPaidTop = baselineY - paidH;
    const yPendingTop = yPaidTop - pendingH;
    const isCurrent = i === currentMonthIdx;
    const isPeak = i === data.peakIdx && paid > 0;

    const r = Math.min(3, Math.max(2, barW / 5));
    const topPath = (x0, y0, h) => {
      if (h <= 0) return '';
      const rr = Math.min(r, h / 2);
      return `M ${x0},${y0 + h} L ${x0},${y0 + rr} Q ${x0},${y0} ${x0 + rr},${y0} L ${x0 + barW - rr},${y0} Q ${x0 + barW},${y0} ${x0 + barW},${y0 + rr} L ${x0 + barW},${y0 + h} Z`;
    };

    const currentBg = isCurrent
      ? `<rect x="${padL + stepX * i + 1}" y="${padT - 8}" width="${stepX - 2}" height="${plotH + 12}" rx="4" fill="#FAFAFA" />`
      : '';

    let paidEl = '';
    let pendingEl = '';
    if (paid > 0) {
      if (pending > 0) {
        paidEl = `<rect x="${x}" y="${yPaidTop}" width="${barW}" height="${Math.max(paidH, 1)}" fill="url(#barPaidFill)" />`;
      } else {
        paidEl = `<path d="${topPath(x, yPaidTop, paidH)}" fill="url(#barPaidFill)" />`;
      }
    }
    if (pending > 0) {
      pendingEl = `<path d="${topPath(x, yPendingTop, pendingH)}" fill="#E4E4E7" />`;
    }

    const valueLabelY = yPaidTop - 10;
    const showValue = paid > 0 && valueLabelY > padT - 18;

    return `
      ${currentBg}
      <g class="stat-bar" data-label="${escapeHTML(lab)}" data-paid="${paid}" data-pending="${pending}" data-total="${total}" style="cursor:pointer;">
        ${hasData(total) ? `
          ${pendingEl}
          ${paidEl}
          ${showValue ? `<text x="${x + barW / 2}" y="${valueLabelY}" text-anchor="middle" font-size="11" font-weight="600" fill="${INK}" font-family="Inter, sans-serif" class="tabular-nums chart-value-label">${escapeHTML(compactMoney(paid))}</text>` : ''}
          ${isCurrent && paid > 0 ? `<circle cx="${x + barW / 2}" cy="${yPaidTop - 4}" r="3" fill="${BRAND}" stroke="#FFFFFF" stroke-width="1.5" />` : ''}
        ` : `
          <rect x="${x}" y="${baselineY - 2}" width="${barW}" height="2" fill="#E4E4E7" rx="1" />
        `}
        <rect class="stat-bar-hit" x="${padL + stepX * i}" y="${padT - 20}" width="${stepX}" height="${plotH + 24}" fill="transparent" />
      </g>
    `;
  }).join('');

  // X-axis labels
  const xLabels = data.labels.map((lab, i) => {
    const x = padL + stepX * i + stepX / 2;
    const isCurrent = i === currentMonthIdx;
    const fill = isCurrent ? INK : '#71717A';
    const weight = isCurrent ? '700' : '500';
    return `<text x="${x}" y="${H - padB + 22}" text-anchor="middle" font-size="11" fill="${fill}" font-weight="${weight}" font-family="Inter, sans-serif">${escapeHTML(lab)}</text>`;
  }).join('');

  // Peak annotation
  let peakAnn = '';
  if (data.peakIdx >= 0 && data.peakVal > 0) {
    const px = padL + stepX * data.peakIdx + stepX / 2;
    const py = baselineY - (data.paid[data.peakIdx] / niceMax) * plotH;
    const annY = Math.max(padT + 16, py - 36);
    peakAnn = `
      <g class="peak-annotation">
        <line x1="${px}" y1="${py - 12}" x2="${px}" y2="${annY + 12}" stroke="${BRAND}" stroke-width="1" stroke-dasharray="2 2" />
        <g transform="translate(${px}, ${annY})">
          <rect x="-40" y="-16" width="80" height="24" rx="12" fill="${BRAND}" />
          <text x="0" y="2" text-anchor="middle" font-size="10.5" font-weight="700" fill="#FFFFFF" font-family="Inter, sans-serif" class="tabular-nums">PICO ${escapeHTML(data.labels[data.peakIdx])}</text>
        </g>
      </g>
    `;
  }

  return `
    <div class="chart-wrap" data-chart="stats-bars">
      <div class="w-full overflow-x-auto">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de barras: recaudación vs pendiente por mes" class="w-full h-auto chart-svg" preserveAspectRatio="xMidYMid meet" style="min-width: 520px;">
          <defs>
            <linearGradient id="barPaidFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${BRAND}" stop-opacity="1"/>
              <stop offset="100%" stop-color="${BRAND_DARK}" stop-opacity="1"/>
            </linearGradient>
          </defs>
          ${gridLines.join('')}
          ${yLabels.join('')}
          ${watermark}
          ${bars}
          ${xLabels}
          ${peakAnn}
        </svg>
      </div>
      <div class="chart-tooltip" role="tooltip" aria-hidden="true"></div>
    </div>
  `;
}

function hasData(total) { return total > 0; }

// ============ LINES CHART (Evolución) ============ //

function linesChart(data, currentMonthIdx) {
  // data: { labels, values, totals, avg, min, max, minIdx, maxIdx }
  const W = 640, H = 360;
  const padL = 48, padR = 20, padT = 48, padB = 44;
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

  // Gridlines horizontales (0, 25, 50, 75, 100)
  const gridLines = [];
  const yLabels = [];
  for (let i = 0; i <= 4; i++) {
    const v = (maxV / 4) * i;
    const y = baselineY - (v / maxV) * plotH;
    const isZero = i === 0;
    gridLines.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${isZero ? '#E4E4E7' : '#F4F4F5'}" stroke-width="1" ${isZero ? '' : 'stroke-dasharray="2 4"'} />`);
    yLabels.push(`<text x="${padL - 10}" y="${y + 3.5}" text-anchor="end" font-size="10.5" fill="#A1A1AA" font-family="Inter, sans-serif">${v}%</text>`);
  }

  // Banda del promedio (zona de sombra entre 40% y 100% como rango sano)
  const healthyTop = baselineY - (100 / maxV) * plotH;
  const healthyBot = baselineY - (40 / maxV) * plotH;
  const healthyBand = `
    <rect x="${padL}" y="${healthyTop}" width="${plotW}" height="${healthyBot - healthyTop}" fill="#F4F4F5" opacity="0.4" />
  `;

  // Línea de promedio
  const avg = data.avg;
  const avgY = baselineY - (avg / maxV) * plotH;
  const avgClampedY = Math.max(padT + 14, Math.min(avgY, baselineY - 10));
  const avgLine = `
    <line x1="${padL}" y1="${avgY}" x2="${W - padR}" y2="${avgY}" stroke="${BRAND}" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.7" />
    <g transform="translate(${padL + 8}, ${avgClampedY - 18})">
      <rect x="0" y="0" width="84" height="18" rx="9" fill="#FFFFFF" stroke="${BRAND}" stroke-width="1" />
      <text x="42" y="13" text-anchor="middle" font-size="10.5" font-weight="600" fill="${BRAND}" font-family="Inter, sans-serif" class="tabular-nums">Promedio ${avg}%</text>
    </g>
  `;

  // Smooth path + area
  const smooth = smoothPath(points);
  const curveTail = smooth.replace(/^M [^ ]+ /, '');
  const areaPath = `M ${points[0].x},${baselineY} L ${points[0].x},${points[0].y} ${curveTail} L ${points[n - 1].x},${baselineY} Z`;

  const allZero = data.values.every((v) => v === 0);
  const emptyMsg = allZero
    ? `<text x="${W / 2}" y="${padT + plotH / 2 + 4}" text-anchor="middle" font-size="11" fill="#A1A1AA" font-family="Inter, sans-serif">Sin pagos en este año</text>`
    : '';

  // X-axis labels
  const xLabels = data.labels.map((lab, i) => {
    const x = padL + stepX * i;
    const isCurrent = i === currentMonthIdx;
    const fill = isCurrent ? INK : '#71717A';
    const weight = isCurrent ? '700' : '500';
    return `<text x="${x}" y="${H - padB + 22}" text-anchor="middle" font-size="11" fill="${fill}" font-weight="${weight}" font-family="Inter, sans-serif">${escapeHTML(lab)}</text>`;
  }).join('');

  // Dots
  const dots = points.map((p, i) => {
    const isCurrent = i === currentMonthIdx;
    const isMax = i === data.maxIdx;
    const isMin = i === data.minIdx;
    const dotR = isCurrent ? 6 : (isMax || isMin) ? 5 : 3.5;
    const strokeW = isCurrent ? 3 : (isMax || isMin) ? 2.25 : 1.75;
    const stroke = isCurrent ? BRAND : INK;
    return `
      <g class="stat-dot" data-label="${escapeHTML(p.lab)}" data-value="${p.v}" data-total="${p.total}" style="cursor:pointer;">
        ${isCurrent ? `<circle cx="${p.x}" cy="${p.y}" r="11" fill="${BRAND}" opacity="0.15" />` : ''}
        <circle cx="${p.x}" cy="${p.y}" r="${dotR + 6}" fill="transparent" />
        <circle cx="${p.x}" cy="${p.y}" r="${dotR}" fill="#FFFFFF" stroke="${stroke}" stroke-width="${strokeW}" />
      </g>
    `;
  }).join('');

  // Max/Min annotations
  const BADGE_H = 9;
  const BADGE_W = 19;
  function ann(value, idx, label, type) {
    if (idx < 0 || value === undefined) return '';
    const p = points[idx];
    if (!p) return '';
    const labelY = type === 'max'
      ? Math.max(p.y - BADGE_H - 22, padT + 12)
      : Math.min(p.y + BADGE_H + 16, baselineY - 12);
    const labelX = Math.max(BADGE_W, Math.min(p.x, W - BADGE_W));
    const bg = type === 'max' ? '#047857' : '#B91C1C';
    return `
      <g transform="translate(${labelX}, ${labelY})">
        <rect x="-22" y="-12" width="44" height="22" rx="11" fill="${bg}" />
        <text x="0" y="3" text-anchor="middle" font-size="10.5" font-weight="700" fill="#FFFFFF" font-family="Inter, sans-serif" class="tabular-nums">${value}%</text>
      </g>
    `;
  }
  const maxAnn = data.maxIdx !== currentMonthIdx ? ann(data.max, data.maxIdx, data.labels[data.maxIdx], 'max') : '';
  const minAnn = data.minIdx !== currentMonthIdx ? ann(data.min, data.minIdx, data.labels[data.minIdx], 'min') : '';

  return `
    <div class="chart-wrap" data-chart="stats-lines">
      <div class="w-full overflow-x-auto">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de líneas: porcentaje cobrado por mes" class="w-full h-auto chart-svg" preserveAspectRatio="xMidYMid meet" style="min-width: 520px;">
          <defs>
            <linearGradient id="lineAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${BRAND}" stop-opacity="0.35"/>
              <stop offset="100%" stop-color="${BRAND}" stop-opacity="0"/>
            </linearGradient>
          </defs>
          ${gridLines.join('')}
          ${yLabels.join('')}
          ${healthyBand}
          <path d="${areaPath}" fill="url(#lineAreaFill)" />
          <path d="${smooth}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
          ${avgLine}
          ${dots}
          ${maxAnn}
          ${minAnn}
          ${emptyMsg}
          ${xLabels}
        </svg>
      </div>
      <div class="chart-tooltip" role="tooltip" aria-hidden="true"></div>
    </div>
  `;
}

// ============ DONUT CHART (Pastel por categoría) ============ //

function donutChart(donut) {
  const size = 260;
  const cx = size / 2, cy = size / 2;
  const r = 100;
  const stroke = 28;
  const C = 2 * Math.PI * r;

  if (donut.total === 0) {
    return `<p class="text-sm text-zinc-500 py-6 text-center">Sin datos para graficar.</p>`;
  }

  let offset = 0;
  const segments = donut.segments.map((s, i) => {
    const frac = s.paid / donut.total;
    const dash = frac * C;
    const gap = C - dash;
    const isFirst = i === 0;
    const path = `
      <circle class="donut-seg" cx="${cx}" cy="${cy}" r="${r}"
              fill="none" stroke="${escapeHTML(s.color)}" stroke-width="${stroke}"
              stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset}"
              transform="rotate(-90 ${cx} ${cy})"
              data-name="${escapeHTML(s.name)}" data-paid="${s.paid}" data-pending="${s.pending}" data-total="${s.total}" data-pct="${s.pct}"
              style="cursor:pointer; transition: opacity 120ms; ${isFirst ? 'filter: drop-shadow(0 2px 6px rgba(242,107,31,0.25));' : ''}" />
    `;
    offset += dash;
    return path;
  }).join('');

  // Etiqueta principal: el segmento top con su nombre y monto
  const top = donut.segments[0];
  const topName = top.name.length > 14 ? top.name.slice(0, 13) + '…' : top.name;

  const centerHTML = `
    <text x="${cx}" y="${cy - 28}" text-anchor="middle" font-size="10" fill="#A1A1AA" font-family="Inter, sans-serif" letter-spacing="2" text-transform="uppercase">RECAUDADO</text>
    <text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="32" font-weight="700" fill="${INK}" font-family="Inter, sans-serif" letter-spacing="-1" class="tabular-nums">${escapeHTML(formatMXN(donut.recaudado))}</text>
    <text x="${cx}" y="${cy + 30}" text-anchor="middle" font-size="11.5" font-weight="600" fill="${top.color}" font-family="Inter, sans-serif">${escapeHTML(topName)} · ${top.sharePct}%</text>
    <text x="${cx}" y="${cy + 48}" text-anchor="middle" font-size="10" fill="#A1A1AA" font-family="Inter, sans-serif" class="tabular-nums">${donut.totalCategorias} categoría${donut.totalCategorias === 1 ? '' : 's'}</text>
  `;

  return `
    <div class="chart-wrap donut-wrap" data-chart="stats-donut">
      <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Distribución de cobranza por categoría" class="w-full max-w-[260px] mx-auto">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F4F4F5" stroke-width="${stroke}" />
        ${segments}
        ${centerHTML}
      </svg>
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
  const total = paid.reduce((s, v) => s + v, 0);
  const max = Math.max(...paid.map((v, i) => v + pending[i]), 0);
  const peakIdx = paid.indexOf(Math.max(...paid));
  const peakVal = peakIdx >= 0 ? paid[peakIdx] : 0;
  return { labels, paid, pending, total, max, peakIdx, peakVal, year: f.year };
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
  const max = withData.length > 0 ? Math.max(...withData) : 0;
  const min = withData.length > 0 ? Math.min(...withData) : 0;
  const maxIdx = values.indexOf(max);
  const minIdx = values.indexOf(min);
  return { labels, values, totals, avg, max, min, maxIdx, minIdx };
}

function computeSparkData(f) {
  const months = monthAggregate(f.year);
  const values = months.map((m) => m.paid);
  const max = Math.max(...values, 0);
  return { values, max };
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
  })
  .filter((c) => c.total > 0)
  .sort((a, b) => b.paid - a.paid); // Ordenar por recaudado desc
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