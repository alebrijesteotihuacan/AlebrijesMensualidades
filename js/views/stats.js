// js/views/stats.js
// Vista Estadísticas: filtros por quincena/mes/año + KPIs del período
// + comparación con período anterior + tendencia mensual.

import { state, escapeHTML, ICON } from '../app.js';
import { formatMXN, getCurrentQuincena, monthName } from '../utils/dates.js';

let _filter = null; // { year, month ('all'|1..12), quincena (''|1|2) }

export function renderStats(root) {
  const current = getCurrentQuincena();
  if (!_filter) {
    _filter = { year: current.year, month: String(current.month), quincena: '' };
  } else {
    // Sincronizar año si quedó muy viejo
    const years = availableYears();
    if (!years.includes(_filter.year)) _filter.year = current.year;
  }

  paint(root);
}

function paint(root) {
  const years = availableYears();
  const stats = computeStats(_filter);
  const prev  = computePrevious(_filter);

  const trend = computeTrend(_filter.year);
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
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label class="label" for="s-year">Año</label>
            <select id="s-year" class="select">
              ${years.map((y) => `<option value="${y}" ${_filter.year === y ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label" for="s-month">Mes</label>
            <select id="s-month" class="select">
              <option value="all" ${_filter.month === 'all' ? 'selected' : ''}>Todo el año</option>
              ${[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => `<option value="${m}" ${_filter.month === String(m) ? 'selected' : ''}>${escapeHTML(monthName(m - 1))}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label" for="s-q">Quincena</label>
            <select id="s-q" class="select">
              <option value="" ${_filter.quincena === '' ? 'selected' : ''}>Ambas</option>
              <option value="1" ${_filter.quincena === '1' ? 'selected' : ''}>Q1 (1-15)</option>
              <option value="2" ${_filter.quincena === '2' ? 'selected' : ''}>Q2 (16-31)</option>
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
          ${statBlock('Recaudado',  formatMXN(stats.recaudado),  `${stats.cobradoPct}% cobrado`, 'success')}
          ${statBlock('Pendiente',  formatMXN(stats.pendiente),  `${stats.pendientePagos} pagos`, 'warning')}
          ${statBlock('Cobrado',    `${stats.cobradoPct}%`,     `${stats.cobradoPagos} de ${stats.totalPagos}`, stats.cobradoPct >= 70 ? 'success' : stats.cobradoPct >= 40 ? 'warning' : 'danger')}
          ${statBlock('Jugadores',  stats.jugadoresUnicos,       `con al menos un pago`)}
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
          ${compareBlock('Recaudado',  formatMXN(stats.recaudado),  formatMXN(prev.recaudado),  deltaPct(stats.recaudado, prev.recaudado))}
          ${compareBlock('Pendiente',  formatMXN(stats.pendiente),  formatMXN(prev.pendiente),  deltaPct(stats.pendiente, prev.pendiente))}
          ${compareBlock('Cobrado %',  `${stats.cobradoPct}%`,      `${prev.cobradoPct}%`,      stats.cobradoPct - prev.cobradoPct, true)}
        </div>
      </div>

      <!-- Tendencia mensual (últimos 12 meses) -->
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="section-eyebrow">Tendencia</p>
            <h2 class="text-base font-semibold mt-1">Recaudación mensual ${_filter.year}</h2>
          </div>
          <span class="text-xs text-zinc-500 tabular-nums">Total año: ${formatMXN(trend.yearTotal)}</span>
        </div>
        ${trend.rows.length === 0
          ? `<p class="text-sm text-zinc-500 py-6 text-center">Aún no hay pagos en ${_filter.year}.</p>`
          : `<div class="flex flex-col">${trend.rows.map(trendRow).join('')}</div>`
        }
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
    _filter.month = e.target.value; // 'all' o '1'..'12'
    paint(root);
  });
  root.querySelector('#s-q').addEventListener('change', (e) => {
    _filter.quincena = e.target.value; // ''|'1'|'2'
    paint(root);
  });
  root.querySelector('#reset-filter').addEventListener('click', () => {
    const c = getCurrentQuincena();
    _filter = { year: c.year, month: String(c.month), quincena: '' };
    paint(root);
  });
}

// ============ COMPONENTES ============ //

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

function trendRow(r) {
  const max = Math.max(1, r.total);
  const paidPct = r.total ? Math.round((r.paid / r.total) * 100) : 0;
  return `
    <div class="cat-row">
      <div class="flex items-center justify-between mb-1.5">
        <span class="cat-name">${escapeHTML(r.label)}</span>
        <span class="cat-count">${formatMXN(r.paid)} · ${paidPct}%</span>
      </div>
      <div class="progress">
        <div class="bar-paid"    style="width:${paidPct}%"></div>
        <div class="bar-pending" style="width:${100 - paidPct}%"></div>
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

// ============ CALCULOS ============ //

function availableYears() {
  const years = new Set([getCurrentQuincena().year, ...state.payments.map((p) => Number(p.year))]);
  return [...years].sort((a, b) => b - a);
}

function filterPayments(f) {
  return state.payments.filter((p) => {
    if (Number(p.year) !== f.year) return false;
    if (f.month !== 'all' && Number(p.month) !== Number(f.month)) return false;
    if (f.quincena !== '' && Number(p.quincena) !== Number(f.quincena)) return false;
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
  return {
    recaudado, pendiente, totalEsperado,
    cobradoPagos, pendientePagos, totalPagos,
    cobradoPct,
    jugadoresUnicos,
  };
}

function computePrevious(f) {
  // Determinar el "período anterior" en función del filtro actual
  let prevY = f.year;
  let prevM;
  let prevQ;

  if (f.month === 'all') {
    // Período anterior = año completo anterior
    return { filter: { year: f.year - 1, month: 'all', quincena: '' }, ...computeStats({ year: f.year - 1, month: 'all', quincena: '' }) };
  }

  prevQ = f.quincena;
  prevM = Number(f.month);
  if (f.quincena === '') {
    prevM = Number(f.month) - 1;
    if (prevM < 1) { prevM = 12; prevY -= 1; }
  } else if (f.quincena === '1') {
    // Q1 → Q2 del mes anterior
    prevM = Number(f.month) - 1;
    prevQ = '2';
    if (prevM < 1) { prevM = 12; prevY -= 1; }
  } else if (f.quincena === '2') {
    // Q2 → Q1 del mismo mes
    prevQ = '1';
  }

  const prevFilter = { year: prevY, month: String(prevM), quincena: prevQ };
  return { filter: prevFilter, ...computeStats(prevFilter) };
}

function computeTrend(year) {
  const months = [1,2,3,4,5,6,7,8,9,10,11,12];
  const rows = months.map((m) => {
    const pays = state.payments.filter((p) => Number(p.year) === year && Number(p.month) === m);
    const paid = pays.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
    const pending = pays.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);
    return {
      label: monthName(m - 1),
      paid, pending,
      total: paid + pending,
    };
  });
  const yearTotal = rows.reduce((s, r) => s + r.paid, 0);
  return { rows, yearTotal };
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
  if (!previous || previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return ((current - previous) / previous) * 100;
}

function periodLabel(f) {
  const y = f.year;
  if (f.month === 'all') return `Todo ${y}`;
  const m = monthName(Number(f.month) - 1);
  if (f.quincena === '') return `${m} ${y}`;
  return `${m} ${y} · Q${f.quincena}`;
}
