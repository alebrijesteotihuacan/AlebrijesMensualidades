// js/views/stats.js
// Vista Estadísticas: filtros por año/mes + KPIs del período
// + comparación con período anterior + gráficas de barras y líneas.

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
  const stats = computeStats(_filter);
  const prev  = computePrevious(_filter);
  const bars  = computeBarData(_filter);     // 12 meses: recaudación
  const lines = computeLineData(_filter);    // 12 meses: % cobrado
  const byCategory = computeByCategory(_filter);

  root.innerHTML = `
    <section class="flex flex-col gap-6">
      <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p class="section-eyebrow">Período ${escapeHTML(periodLabel(_filter))}</p>
          <h1 class="section-title text-2xl sm:text-3xl mt-1">Estadísticas</h1>
        </div>
        <button id="reset-filter" type="button" class="btn btn-ghost btn-sm">Período actual</button>
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
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="section-eyebrow">Período seleccionado</p>
            <h2 class="text-base font-semibold mt-1">${escapeHTML(periodLabel(_filter))}</h2>
          </div>
          <span class="status"><span class="status-dot dot-neutral"></span><span>${stats.totalPagos} pagos</span></span>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 divide-x divide-zinc-100">
          ${statBlock('Recaudado', formatMXN(stats.recaudado), `${stats.cobradoPct}% cobrado`, 'success')}
          ${statBlock('Pendiente', formatMXN(stats.pendiente), `${stats.pendientePagos} pago${stats.pendientePagos === 1 ? '' : 's'} sin completar`, 'warning')}
          ${statBlock('% Cobrado',   `${stats.cobradoPct}%`,    `${stats.cobradoPagos} de ${stats.totalPagos} pago${stats.totalPagos === 1 ? '' : 's'}`, stats.cobradoPct >= 70 ? 'success' : stats.cobradoPct >= 40 ? 'warning' : 'danger')}
          ${statBlock('Jugadores', stats.jugadoresUnicos,      `con al menos un pago`)}
        </div>
      </div>

      <!-- Comparación con período anterior -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="section-eyebrow">Comparación</p>
            <h2 class="text-base font-semibold mt-1">vs ${escapeHTML(periodLabel(prev.filter))}</h2>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          ${compareBlock('Recaudado', formatMXN(stats.recaudado), formatMXN(prev.recaudado), deltaPct(stats.recaudado, prev.recaudado))}
          ${compareBlock('Pendiente', formatMXN(stats.pendiente), formatMXN(prev.pendiente), deltaPct(stats.pendiente, prev.pendiente))}
          ${compareBlock('% Cobrado', `${stats.cobradoPct}%`,     `${prev.cobradoPct}%`,     stats.cobradoPct - prev.cobradoPct, true)}
        </div>
      </div>

      <!-- GRÁFICA DE BARRAS: Recaudación por mes -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="section-eyebrow">Tendencia</p>
            <h2 class="text-base font-semibold mt-1">Recaudación por mes · ${_filter.year}</h2>
          </div>
          <span class="text-xs text-zinc-500 tabular-nums">Total: ${formatMXN(bars.total)}</span>
        </div>
        ${barsChart(bars)}
        <p class="text-[11px] text-zinc-500 mt-3">Pasa el cursor sobre una barra para ver el detalle del mes.</p>
      </div>

      <!-- GRÁFICA DE LÍNEAS: % cobrado por mes -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="section-eyebrow">Evolución</p>
            <h2 class="text-base font-semibold mt-1">% Cobrado por mes · ${_filter.year}</h2>
          </div>
          <span class="text-xs text-zinc-500 tabular-nums">Promedio: ${lines.avg}%</span>
        </div>
        ${linesChart(lines)}
        <p class="text-[11px] text-zinc-500 mt-3">Pasa el cursor sobre un punto para ver el detalle del mes.</p>
      </div>

      <!-- Por categoría del período -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="section-eyebrow">Por categoría</p>
            <h2 class="text-base font-semibold mt-1">Cobranza del período</h2>
          </div>
          <span class="text-xs text-zinc-500 tabular-nums">${byCategory.length} categorías</span>
        </div>
        ${byCategory.length === 0
          ? `<p class="text-sm text-zinc-500 py-6 text-center">Sin categorías con pagos en este período.</p>`
          : `<div class="table-wrap overflow-x-auto">
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

function statBlock(label, value, sub, tone) {
  const dotClass = tone === 'success' ? 'dot-success' : tone === 'warning' ? 'dot-warning' : tone === 'danger' ? 'dot-danger' : 'dot-neutral';
  return `
    <div class="px-4 sm:px-6 first:pl-0 sm:first:pl-6 last:pr-0 sm:last:pr-6">
      <p class="stat-label">${escapeHTML(label)}</p>
      <p class="stat-value mt-1">${value}</p>
      <div class="flex items-center gap-1.5 mt-1.5">
        <span class="status-dot ${dotClass}"></span>
        <p class="stat-sub">${escapeHTML(sub)}</p>
      </div>
    </div>
  `;
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
  return `
    <tr>
      <td class="font-medium">${escapeHTML(c.name)}</td>
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
  // data: { labels: ['Ene',...], values: [n1,...], total, max }
  const W = 600, H = 260;
  const padL = 50, padR = 16, padT = 16, padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.values.length;
  const gapRatio = 0.35;
  const barW = (plotW / n) * (1 - gapRatio);
  const stepX = plotW / n;
  const maxV = Math.max(1, data.max);
  // Escala "nice": redondeamos max hacia arriba para grid
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
  const bars = data.values.map((v, i) => {
    const x = padL + stepX * i + (stepX - barW) / 2;
    const h = (v / niceMax) * plotH;
    const y = padT + plotH - h;
    const isZero = v === 0;
    return `
      <g class="stat-bar" data-label="${escapeHTML(data.labels[i])}" data-value="${v}" style="cursor:pointer;">
        <rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 1)}"
              fill="${isZero ? '#E4E4E7' : '#09090B'}" rx="2" />
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
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de barras: recaudación por mes" class="w-full h-auto" style="min-width: 480px;">
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
  // data: { labels: ['Ene',...], values: [0..100,...], avg, max }
  const W = 600, H = 260;
  const padL = 40, padR = 16, padT = 16, padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.values.length;
  const stepX = plotW / (n - 1 || 1);
  const minV = 0, maxV = 100;

  // Grid horizontal (0, 25, 50, 75, 100)
  const gridSteps = 4;
  const gridLines = [];
  const yLabels = [];
  for (let i = 0; i <= gridSteps; i++) {
    const v = (maxV / gridSteps) * i;
    const y = padT + plotH - (v / maxV) * plotH;
    gridLines.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#F4F4F5" stroke-width="1" />`);
    yLabels.push(`<text x="${padL - 8}" y="${y + 3}" text-anchor="end" font-size="10" fill="#71717A" font-family="Inter, sans-serif">${v}%</text>`);
  }

  // Puntos y línea
  const points = data.values.map((v, i) => {
    const x = padL + stepX * i;
    const y = padT + plotH - (v / maxV) * plotH;
    return { x, y, v, lab: data.labels[i] };
  });

  // Línea promedio (referencia)
  const avg = data.avg;
  const avgY = padT + plotH - (avg / maxV) * plotH;
  const avgLine = `
    <line x1="${padL}" y1="${avgY}" x2="${W - padR}" y2="${avgY}"
          stroke="#A1A1AA" stroke-width="1" stroke-dasharray="3 3" />
    <text x="${W - padR - 4}" y="${avgY - 4}" text-anchor="end" font-size="10" fill="#71717A" font-family="Inter, sans-serif">Promedio ${avg}%</text>
  `;

  // Polyline
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const linePath = `
    <polyline points="${polyline}" fill="none" stroke="#09090B" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
  `;

  // Puntos
  const dots = points.map((p) => `
    <g class="stat-dot" data-label="${escapeHTML(p.lab)}" data-value="${p.v}" style="cursor:pointer;">
      <circle cx="${p.x}" cy="${p.y}" r="14" fill="transparent" />
      <circle cx="${p.x}" cy="${p.y}" r="3" fill="white" stroke="#09090B" stroke-width="1.5" />
    </g>
  `).join('');

  // Si no hay datos válidos (todos 0), mensaje sutil
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
          ${gridLines.join('')}
          ${yLabels.join('')}
          ${linePath}
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

// ============ TOOLTIPS DE GRÁFICAS ============ //

function wireStatsTooltip(root) {
  root.querySelectorAll('.chart-wrap').forEach((wrap) => {
    const tip = wrap.querySelector('.chart-tooltip');
    if (!tip) return;
    const chartKind = wrap.dataset.chart;
    wrap.querySelectorAll('[data-label]').forEach((node) => {
      node.addEventListener('mouseenter', (e) => {
        const label = node.dataset.label;
        const value = node.dataset.value;
        if (chartKind === 'stats-bars') {
          tip.innerHTML = `
            <p class="tt-title">${escapeHTML(label)}</p>
            <div class="tt-rows">
              <div class="tt-row tt-row--accent"><span class="tt-label">Recaudado</span><span class="tt-val tabular-nums">${escapeHTML(formatMXN(Number(value)))}</span></div>
            </div>
          `;
        } else {
          tip.innerHTML = `
            <p class="tt-title">${escapeHTML(label)}</p>
            <div class="tt-rows">
              <div class="tt-row tt-row--accent"><span class="tt-label">% Cobrado</span><span class="tt-val tabular-nums">${value}%</span></div>
            </div>
          `;
        }
        tip.classList.add('is-visible');
      });
      node.addEventListener('mousemove', (e) => {
        positionTooltip(e, wrap, tip);
      });
      node.addEventListener('mouseleave', () => {
        tip.classList.remove('is-visible');
      });
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
  // Devuelve array de 12 meses con { paid, total, pct }
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const pays = state.payments.filter((p) =>
      Number(p.year) === year && Number(p.month) === month
    );
    const paid = pays.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
    const total = pays.reduce((s, p) => s + Number(p.amount || 0), 0);
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { month, paid, total, pct };
  });
}

function computeBarData(f) {
  const months = monthAggregate(f.year);
  const labels = months.map((m) => monthShort(m.month - 1));
  const values = months.map((m) => m.paid);
  const total = values.reduce((s, v) => s + v, 0);
  const max = Math.max(...values, 0);
  return { labels, values, total, max };
}

function computeLineData(f) {
  const months = monthAggregate(f.year);
  const labels = months.map((m) => monthShort(m.month - 1));
  const values = months.map((m) => m.pct);
  const withData = values.filter((v) => v > 0 || months[values.indexOf(v)].total > 0);
  const avg = withData.length > 0
    ? Math.round(withData.reduce((s, v) => s + v, 0) / withData.length)
    : 0;
  return { labels, values, avg, max: 100 };
}

function computeByCategory(f) {
  const pays = filterPayments(f);
  const cats = state.categories;
  return cats.map((c) => {
    const inCat = state.players.filter((p) => p.category === c.name).map((p) => p.id);
    const inSet = new Set(inCat);
    const relevant = pays.filter((p) => inSet.has(p.playerId));
    const paid    = relevant.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
    const pending = relevant.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);
    const total = paid + pending;
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { name: c.name, paid, pending, total, pct };
  }).filter((c) => c.total > 0);
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
