// js/views/payments.js
// Vista Pagos: tabla compacta minimalista, sin sección de datos bancarios.

import { state, toast, openModal, confirmModal, escapeHTML, ICON, avatarGradient, amountForPlayer } from '../app.js';
import { payments } from '../services/firestore.js';
import { classifyMora, moraLabel } from '../services/mora.js';
import { renderMessage, copyToClipboard } from '../services/messages.js';
import { formatMXN, formatDate, getCurrentQuincena, quincenaLabel } from '../utils/dates.js';
import { toCSV, toPDF } from '../services/export.js';

let _filter = { playerId: '', year: '', quincena: '', status: '' };

export function renderPayments(root) {
  const current = getCurrentQuincena();

  root.innerHTML = `
    <section class="flex flex-col gap-6">
      <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p class="section-eyebrow">${escapeHTML(quincenaLabel(current.year, current.quincena))} · Período actual</p>
          <h1 class="section-title text-2xl sm:text-3xl mt-1">Pagos</h1>
        </div>
        <button id="btn-new-payment" type="button" class="btn btn-primary">
          ${ICON.plus}<span>Nuevo pago</span>
        </button>
      </header>

      <!-- Toolbar -->
      <div class="card card-pad flex flex-col gap-3">
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div class="col-span-2">
            <label class="label" for="f-player">Jugador</label>
            <select id="f-player" class="select">
              <option value="">Todos</option>
              ${state.players.map((p) => `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label" for="f-year">Año</label>
            <select id="f-year" class="select">
              <option value="">Todos</option>
              ${[...new Set(state.payments.map((p) => p.year))].sort((a,b) => b-a).map((y) => `<option value="${y}">${y}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label" for="f-quincena">Quincena</label>
            <select id="f-quincena" class="select">
              <option value="">Todas</option>
              <option value="1">Q1 (1-15)</option>
              <option value="2">Q2 (16-31)</option>
            </select>
          </div>
          <div>
            <label class="label" for="f-status">Estado</label>
            <select id="f-status" class="select">
              <option value="">Todos</option>
              <option value="paid">Pagado</option>
              <option value="pending">Pendiente</option>
            </select>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 justify-end border-t border-zinc-100 pt-3">
          <button id="f-clear" type="button" class="btn btn-ghost btn-sm">Limpiar</button>
          <button id="btn-export-csv" type="button" class="btn btn-secondary btn-sm">Exportar CSV</button>
          <button id="btn-export-pdf" type="button" class="btn btn-secondary btn-sm">Exportar PDF</button>
        </div>
      </div>

      <!-- Table -->
      <div id="payments-table"></div>
    </section>
  `;

  const playerSel   = root.querySelector('#f-player');
  const yearSel     = root.querySelector('#f-year');
  const quincenaSel = root.querySelector('#f-quincena');
  const statusSel   = root.querySelector('#f-status');
  const clear       = root.querySelector('#f-clear');

  playerSel.value   = _filter.playerId;
  yearSel.value     = _filter.year;
  quincenaSel.value = _filter.quincena;
  statusSel.value   = _filter.status;

  playerSel.addEventListener('change',   (e) => { _filter.playerId   = e.target.value; paint(); });
  yearSel.addEventListener('change',     (e) => { _filter.year       = e.target.value; paint(); });
  quincenaSel.addEventListener('change', (e) => { _filter.quincena   = e.target.value; paint(); });
  statusSel.addEventListener('change',   (e) => { _filter.status     = e.target.value; paint(); });
  clear.addEventListener('click', () => {
    _filter = { playerId: '', year: '', quincena: '', status: '' };
    playerSel.value = yearSel.value = quincenaSel.value = statusSel.value = '';
    paint();
  });

  root.querySelector('#btn-new-payment').addEventListener('click', () => openPaymentForm(null));
  root.querySelector('#btn-export-csv').addEventListener('click', () => exportData('csv'));
  root.querySelector('#btn-export-pdf').addEventListener('click', () => exportData('pdf'));

  paint();

  function paint() {
    const wrap = root.querySelector('#payments-table');
    const filtered = applyFilter(state.payments, _filter)
      .sort((a, b) => (b.year - a.year) || (b.quincena - a.quincena) || (a.playerName || '').localeCompare(b.playerName || ''));

    if (filtered.length === 0) {
      wrap.innerHTML = `<div class="empty-state">
          <div class="empty-state-icon">${ICON.cash}</div>
          <p class="font-semibold">Sin pagos registrados</p>
          <p class="text-sm text-zinc-500 mt-1">Crea el primer pago con el botón "Nuevo pago".</p>
        </div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="table-wrap overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Jugador</th>
              <th class="hidden md:table-cell">Categoría</th>
              <th>Período</th>
              <th class="text-right">Monto</th>
              <th>Estado</th>
              <th class="hidden lg:table-cell">Pagado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(rowHTML).join('')}
          </tbody>
        </table>
      </div>
    `;

    wrap.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => markPaid(b.dataset.pay)));
    wrap.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openPaymentForm(b.dataset.edit)));
    wrap.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => onDelete(b.dataset.del)));
    wrap.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => onCopy(b.dataset.copy)));
  }
}

function applyFilter(list, { playerId, year, quincena, status }) {
  return list
    .filter((p) => !playerId || p.playerId === playerId)
    .filter((p) => !year || String(p.year) === String(year))
    .filter((p) => !quincena || String(p.quincena) === String(quincena))
    .filter((p) => !status || p.status === status)
    .map((p) => ({ ...p, player: state.players.find((pl) => pl.id === p.playerId), playerName: state.players.find((pl) => pl.id === p.playerId)?.name || '—' }));
}

function rowHTML(p) {
  const player = state.players.find((pl) => pl.id === p.playerId);
  const playerName = player?.name || '—';
  const playerCat  = player?.category || '—';
  const isPending  = p.status === 'pending';
  const level      = isPending && player ? classifyMora(player) : null;
  const statusDot  = isPending
    ? (level === 'mora5' || level === 'mora3' ? 'dot-danger' : 'dot-warning')
    : 'dot-success';
  const statusText = isPending ? moraLabel(level || 'recordatorio') : 'Pagado';

  return `
    <tr>
      <td>
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="avatar size-sm shrink-0" style="${avatarGradient(player)}">${escapeHTML(initialsOf(playerName))}</div>
          <span class="font-medium truncate">${escapeHTML(playerName)}</span>
        </div>
      </td>
      <td class="hidden md:table-cell text-zinc-600">${escapeHTML(playerCat)}</td>
      <td class="text-zinc-600 tabular-nums">${escapeHTML(quincenaLabel(p.year, p.quincena))}</td>
      <td class="text-right font-semibold tabular-nums">${formatMXN(p.amount)}</td>
      <td><span class="status"><span class="status-dot ${statusDot}"></span><span>${escapeHTML(statusText)}</span></span></td>
      <td class="hidden lg:table-cell text-zinc-500 tabular-nums">${p.paidDate ? escapeHTML(formatDate(p.paidDate)) : '—'}</td>
      <td class="text-right">
        <div class="inline-flex gap-0.5">
          ${isPending ? `
            <button data-copy="${p.id}" type="button" class="icon-btn" aria-label="Copiar mensaje de pago">${ICON.copy}</button>
            <button data-pay="${p.id}" type="button" class="btn btn-primary btn-sm">${ICON.check}<span>Pagado</span></button>
          ` : ''}
          <button data-edit="${p.id}" type="button" class="icon-btn" aria-label="Editar pago">${ICON.edit}</button>
          <button data-del="${p.id}" type="button" class="icon-btn icon-btn-danger" aria-label="Eliminar pago">${ICON.trash}</button>
        </div>
      </td>
    </tr>
  `;
}

function initialsOf(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
}

// === ACCIONES ===

async function markPaid(id) {
  const p = state.payments.find((x) => x.id === id);
  if (!p) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    await payments.update(id, { status: 'paid', paidDate: today });
    toast('Pago marcado como pagado', 'success');
  } catch (e) {
    console.error(e);
    toast('Error al actualizar', 'error');
  }
}

async function onDelete(id) {
  const ok = await confirmModal({
    title: 'Eliminar pago',
    message: '¿Eliminar este pago? Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    danger: true,
  });
  if (!ok) return;
  try {
    await payments.remove(id);
    toast('Pago eliminado', 'success');
  } catch (err) {
    console.error(err);
    toast('Error al eliminar', 'error');
  }
}

async function onCopy(paymentId) {
  const p = state.payments.find((x) => x.id === paymentId);
  if (!p) return;
  const player = state.players.find((pl) => pl.id === p.playerId);
  if (!player) return;

  const { text, level } = renderMessage(player, p);
  try {
    await copyToClipboard(text);
    toast(`Mensaje copiado (${moraLabel(level)})`, 'success', 3500);
  } catch (e) {
    console.error(e);
    toast('No se pudo copiar', 'error');
  }
}

// === FORMULARIO PAGO ===

function openPaymentForm(id) {
  const editing = id ? state.payments.find((p) => p.id === id) : null;
  const current = getCurrentQuincena();

  const initialDay = editing?.paidDate
    ? Number(editing.paidDate.slice(8, 10))
    : '';
  const months = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
  ];
  const initialMonth = editing?.month ?? current.month;

  const body = `
    <form id="form-payment" class="grid grid-cols-1 sm:grid-cols-2 gap-3.5" novalidate>
      <div class="sm:col-span-2">
        <label class="label" for="py-player">Jugador *</label>
        <select id="py-player" name="playerId" required class="select">
          <option value="">Selecciona…</option>
          ${state.players.map((pl) => `<option value="${pl.id}" ${editing?.playerId === pl.id ? 'selected' : ''}>${escapeHTML(pl.name)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="label" for="py-month">Mes *</label>
        <select id="py-month" name="month" required class="select">
          ${months.map((name, i) => `<option value="${i + 1}" ${initialMonth === i + 1 ? 'selected' : ''}>${name}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="label" for="py-q">Quincena *</label>
        <select id="py-q" name="quincena" required class="select">
          <option value="1" ${(editing?.quincena ?? current.quincena) === 1 ? 'selected' : ''}>Q1 (1-15)</option>
          <option value="2" ${(editing?.quincena ?? current.quincena) === 2 ? 'selected' : ''}>Q2 (16-31)</option>
        </select>
        <p class="form-hint">Se autodefine según el día de pago del jugador.</p>
      </div>
      <div>
        <label class="label" for="py-amount">Monto (MXN) *</label>
        <input id="py-amount" name="amount" type="number" min="0" step="50" required inputmode="numeric" class="input tabular" value="${editing?.amount ?? ''}" />
        <p class="form-hint" id="amount-hint">Selecciona jugador para autocompletar</p>
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="py-paid-day">Día de pago</label>
        <div class="flex items-center gap-2">
          <input id="py-paid-day" name="paidDay" type="number" min="1" max="31" inputmode="numeric" class="input tabular" value="${initialDay}" placeholder="Día del mes" />
          <button data-today type="button" class="btn btn-secondary shrink-0">Hoy</button>
        </div>
        <p class="form-hint" id="paid-hint">Si lo dejas vacío, el pago queda pendiente. Si ingresas un día, queda pagado.</p>
      </div>
      <p id="py-error" class="sm:col-span-2 form-error" hidden></p>
    </form>
  `;

  const footer = `
    <button data-cancel type="button" class="btn btn-secondary">Cancelar</button>
    <button data-save type="button" class="btn btn-primary">${editing ? 'Guardar' : 'Crear pago'}</button>
  `;

  const m = openModal({ title: editing ? 'Editar pago' : 'Nuevo pago', body, footer, size: 'md' });

  const form        = m.panel.querySelector('#form-payment');
  const playerSel   = form.querySelector('[name=playerId]');
  const amountIn    = form.querySelector('[name=amount]');
  const monthSel    = form.querySelector('[name=month]');
  const quincenaSel = form.querySelector('[name=quincena]');
  const dayIn       = form.querySelector('[name=paidDay]');
  const hint        = m.panel.querySelector('#amount-hint');
  const paidHint    = m.panel.querySelector('#paid-hint');

  function syncFromPlayer() {
    const pl = state.players.find((x) => x.id === playerSel.value);
    if (pl) {
      const amt = amountForPlayer(pl);
      if (!amountIn.value) amountIn.value = amt;
      const expectedQ = Number(pl.paymentDay) <= 15 ? 1 : 2;
      quincenaSel.value = String(expectedQ);
      hint.textContent = `${formatMXN(amt)} · día ${pl.paymentDay} → Q${expectedQ}`;
    } else {
      hint.textContent = 'Selecciona jugador para autocompletar';
    }
  }
  playerSel.addEventListener('change', () => { amountIn.value = ''; syncFromPlayer(); });
  syncFromPlayer();

  // Botón "Hoy": pone el día actual (del mes seleccionado)
  m.panel.querySelector('[data-today]').addEventListener('click', () => {
    const today = new Date();
    const selMonth = Number(monthSel.value);
    const todayMonth = today.getMonth() + 1;
    let day;
    if (selMonth === todayMonth) {
      day = today.getDate();
    } else {
      // Mes distinto al actual: poner el último día válido del mes seleccionado
      day = new Date(today.getFullYear(), selMonth, 0).getDate();
    }
    dayIn.value = String(day);
    dayIn.focus();
    dayIn.select();
    // Disparar evento 'input' para actualizar el hint
    dayIn.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Hint dinámico según haya día o no
  function syncPaidHint() {
    if (dayIn.value) {
      paidHint.textContent = 'Pagado: el día seleccionado del mes elegido.';
    } else {
      paidHint.textContent = 'Pendiente: deja el día vacío.';
    }
  }
  dayIn.addEventListener('input', syncPaidHint);
  syncPaidHint();

  m.panel.querySelector('[data-cancel]').addEventListener('click', m.close);
  m.panel.querySelector('[data-save]').addEventListener('click', async () => {
    const errEl = m.panel.querySelector('#py-error');
    errEl.hidden = true;

    if (!playerSel.value) { showErr('Selecciona un jugador'); playerSel.focus(); return; }
    if (!amountIn.value || Number(amountIn.value) < 0) { showErr('Monto inválido'); amountIn.focus(); return; }

    const dayVal = dayIn.value.trim();
    let paidDate = null;
    if (dayVal !== '') {
      const d = Number(dayVal);
      if (!Number.isFinite(d) || d < 1 || d > 31) {
        showErr('El día debe estar entre 1 y 31'); dayIn.focus(); return;
      }
      const year = new Date().getFullYear();
      const month = Number(monthSel.value);
      const lastDay = new Date(year, month, 0).getDate();
      const safeDay = Math.min(d, lastDay);
      paidDate = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
    }

    const data = {
      playerId: playerSel.value,
      year:      new Date().getFullYear(),
      month:     Number(monthSel.value),
      quincena:  Number(quincenaSel.value),
      amount:    Number(amountIn.value),
      status:    paidDate ? 'paid' : 'pending',
      paidDate,
    };
    try {
      if (editing) {
        await payments.update(editing.id, data);
        toast('Pago actualizado', 'success');
      } else {
        await payments.add(data);
        toast('Pago creado', 'success');
      }
      m.close();
    } catch (e) {
      console.error(e);
      toast('Error al guardar', 'error');
    }

    function showErr(msg) {
      errEl.textContent = msg;
      errEl.hidden = false;
    }
  });
}

// === EXPORTAR ===

function exportData(format) {
  const filtered = applyFilter(state.payments, _filter);
  const columns = ['Jugador', 'Categoría', 'Año', 'Quincena', 'Monto', 'Estado', 'Fecha de pago'];
  const rows = filtered.map((p) => {
    const pl = state.players.find((x) => x.id === p.playerId);
    return [
      pl?.name || '—',
      pl?.category || '—',
      p.year,
      `Q${p.quincena}`,
      formatMXN(p.amount).replace('$', '').trim(),
      p.status === 'paid' ? 'Pagado' : 'Pendiente',
      p.paidDate ? formatDate(p.paidDate) : '—',
    ];
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `pagos-alebrijes-${stamp}`;

  if (format === 'csv') {
    toCSV(filtered.map((p) => {
      const pl = state.players.find((x) => x.id === p.playerId);
      return {
        Jugador: pl?.name || '',
        Categoría: pl?.category || '',
        Año: p.year,
        Quincena: `Q${p.quincena}`,
        Monto: p.amount,
        Estado: p.status === 'paid' ? 'Pagado' : 'Pendiente',
        'Fecha de pago': p.paidDate || '',
      };
    }), `${filename}.csv`, columns);
    toast('CSV exportado', 'success');
  } else {
    toPDF({ title: 'Pagos - Alebrijes Teotihuacán', columns, rows, filename: `${filename}.pdf` });
    toast('PDF generado', 'success');
  }
}
