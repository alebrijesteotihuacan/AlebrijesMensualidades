// js/views/payments.js
// Vista Pagos: tabla compacta minimalista, sin sección de datos bancarios.
// Pagos mensuales: cada jugador paga el día 1 o 15 de cada mes.

import { state, toast, openModal, confirmModal, escapeHTML, ICON, avatarGradient, amountForPlayer } from '../app.js';
import { payments } from '../services/firestore.js';
import { classifyAdeudo, adeudoLabel } from '../services/adeudo.js';
import { renderMessage, copyToClipboard } from '../services/messages.js';
import { formatMXN, formatDate, monthName } from '../utils/dates.js';
import { toCSV, toPDF } from '../services/export.js';

let _filter = { playerId: '', year: '', month: '', status: '' };

export function renderPayments(root) {
  const today = new Date();

  root.innerHTML = `
    <section class="flex flex-col gap-6">
      <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p class="section-eyebrow">Mensualidades</p>
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
            <label class="label" for="f-month">Mes</label>
            <select id="f-month" class="select">
              <option value="">Todos</option>
              ${[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => `<option value="${m}">${escapeHTML(monthName(m - 1))}</option>`).join('')}
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

  const playerSel = root.querySelector('#f-player');
  const yearSel   = root.querySelector('#f-year');
  const monthSel  = root.querySelector('#f-month');
  const statusSel = root.querySelector('#f-status');
  const clear     = root.querySelector('#f-clear');

  playerSel.value = _filter.playerId;
  yearSel.value   = _filter.year;
  monthSel.value  = _filter.month;
  statusSel.value = _filter.status;

  playerSel.addEventListener('change', (e) => { _filter.playerId = e.target.value; paint(); });
  yearSel.addEventListener('change',   (e) => { _filter.year     = e.target.value; paint(); });
  monthSel.addEventListener('change',  (e) => { _filter.month    = e.target.value; paint(); });
  statusSel.addEventListener('change', (e) => { _filter.status   = e.target.value; paint(); });
  clear.addEventListener('click', () => {
    _filter = { playerId: '', year: '', month: '', status: '' };
    playerSel.value = yearSel.value = monthSel.value = statusSel.value = '';
    paint();
  });

  root.querySelector('#btn-new-payment').addEventListener('click', () => openPaymentForm(null));
  root.querySelector('#btn-export-csv').addEventListener('click', () => exportData('csv'));
  root.querySelector('#btn-export-pdf').addEventListener('click', () => exportData('pdf'));

  paint();

  function paint() {
    const wrap = root.querySelector('#payments-table');
    const filtered = applyFilter(state.payments, _filter)
      .sort((a, b) => (b.year - a.year) || (b.month - a.month) || (a.playerName || '').localeCompare(b.playerName || ''));

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

function applyFilter(list, { playerId, year, month, status }) {
  return list
    .filter((p) => !playerId || p.playerId === playerId)
    .filter((p) => !year || String(p.year) === String(year))
    .filter((p) => !month || String(p.month) === String(month))
    .filter((p) => !status || p.status === status)
    .map((p) => ({ ...p, player: state.players.find((pl) => pl.id === p.playerId), playerName: state.players.find((pl) => pl.id === p.playerId)?.name || '—' }));
}

function rowHTML(p) {
  const player = state.players.find((pl) => pl.id === p.playerId);
  const playerName = player?.name || '—';
  const playerCat  = player?.category || '—';
  const isPending  = p.status === 'pending';
  const level      = isPending && player ? classifyAdeudo(player) : null;
  const statusDot  = isPending
    ? (level === 'adeudo5' || level === 'adeudo3' ? 'dot-danger' : 'dot-warning')
    : 'dot-success';
  const statusText = isPending ? adeudoLabel(level || 'recordatorio') : 'Pagado';

  return `
    <tr>
      <td>
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="avatar size-sm shrink-0" style="${avatarGradient(player)}">${escapeHTML(initialsOf(playerName))}</div>
          <span class="font-medium truncate">${escapeHTML(playerName)}</span>
        </div>
      </td>
      <td class="hidden md:table-cell text-zinc-600">${escapeHTML(playerCat)}</td>
      <td class="text-zinc-600 tabular-nums">${escapeHTML(monthName(Number(p.month) - 1))} ${p.year}</td>
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
    toast(`Mensaje copiado (${adeudoLabel(level)})`, 'success', 3500);
  } catch (e) {
    console.error(e);
    toast('No se pudo copiar', 'error');
  }
}

// === FORMULARIO PAGO (rehecho: bulletproof + UX clara) ===

export function openPaymentForm(id, preSelectedPlayerId = null) {
  const editing = id ? state.payments.find((p) => p.id === id) : null;
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  // Estado mutable
  let selectedPlayer = editing
    ? state.players.find((p) => p.id === editing.playerId)
    : (preSelectedPlayerId ? state.players.find((p) => p.id === preSelectedPlayerId) : null);
  let selYear  = Number(editing?.year  ?? currentYear);
  let selMonth = Number(editing?.month ?? currentMonth);
  let paidDay  = editing?.paidDate ? Number(editing.paidDate.slice(8, 10)) : null;
  let amount   = editing?.amount ?? (selectedPlayer ? amountForPlayer(selectedPlayer) : null);

  // --- Render del bloque de jugador ---
  function renderPlayerBlock() {
    if (selectedPlayer) {
      const amt = amountForPlayer(selectedPlayer);
      return `
        <button type="button" class="player-picker is-selected" data-action="change-player" aria-label="Cambiar jugador">
          <div class="avatar size-md" style="${avatarGradient(selectedPlayer)}">${escapeHTML(initialsOf(selectedPlayer.name))}</div>
          <div class="flex-1 min-w-0 text-left">
            <p class="pp-name truncate">${escapeHTML(selectedPlayer.name)}</p>
            <p class="pp-meta truncate">${escapeHTML(selectedPlayer.category || 'Sin categoría')} · día ${selectedPlayer.paymentDay} · ${escapeHTML(formatMXN(amt))}/mes</p>
          </div>
          <span class="pp-check">${ICON.check}</span>
          <span class="pp-change">Cambiar</span>
        </button>
      `;
    }
    return `
      <div class="player-picker-empty">
        <div class="relative">
          <svg viewBox="0 0 20 20" fill="currentColor" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/></svg>
          <input id="py-player-search" type="text" autocomplete="off" placeholder="Busca un jugador por nombre o teléfono…" class="input pl-9" />
        </div>
        <ul id="py-player-list" class="player-list" role="listbox" aria-label="Lista de jugadores"></ul>
      </div>
    `;
  }

  // --- Render de los chips de período ---
  function renderPeriodChips() {
    const chips = [];
    for (let i = -3; i <= 2; i++) {
      const mAbs = currentMonth + i;
      const yAbs = currentYear + Math.floor((mAbs - 1) / 12);
      const realM = ((mAbs - 1) % 12 + 12) % 12 + 1;
      const isPaid = selectedPlayer ? state.payments.some((pay) =>
        pay.playerId === selectedPlayer.id &&
        Number(pay.year) === yAbs &&
        Number(pay.month) === realM &&
        pay.status === 'paid'
      ) : false;
      const isCurrent = realM === currentMonth && yAbs === currentYear;
      const label = isCurrent ? 'Este mes' : `${monthShort(realM - 1)} ${yAbs !== currentYear ? `'${String(yAbs).slice(-2)}` : ''}`;
      const monthFull = monthName(realM - 1);
      chips.push({ y: yAbs, m: realM, label, monthFull, isPaid, isCurrent });
    }
    return `
      <div class="period-chips" role="radiogroup" aria-label="Mes del pago">
        ${chips.map((c) => `
          <button type="button"
            class="period-chip ${(c.y === selYear && c.m === selMonth) ? 'is-active' : ''} ${c.isPaid ? 'is-paid' : ''}"
            data-action="select-period"
            data-period="${c.y}-${c.m}"
            ${c.isPaid ? 'disabled' : ''}
            role="radio"
            aria-checked="${(c.y === selYear && c.m === selMonth)}"
            title="${escapeHTML(c.monthFull + ' ' + c.y)}${c.isPaid ? ' (ya pagado)' : ''}">
            ${c.isPaid ? '<span class="pc-tick">✓</span>' : ''}
            <span>${escapeHTML(c.label)}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  // --- Render del monto ---
  function renderAmount() {
    const val = (amount != null && amount !== '') ? String(amount) : '';
    const hint = selectedPlayer
      ? `Mensualidad de ${escapeHTML(selectedPlayer.name)}: ${escapeHTML(formatMXN(amountForPlayer(selectedPlayer)))}`
      : 'Selecciona un jugador para sugerir un monto';
    return `
      <div class="amount-field">
        <span class="amount-prefix">$</span>
        <input id="py-amount" type="number" min="0" step="50" inputmode="numeric" class="input tabular amount-input" value="${val}" placeholder="0" />
        <span class="amount-suffix">MXN</span>
      </div>
      <p class="form-hint" id="amount-hint">${hint}</p>
    `;
  }

  // --- Render del día ---
  function renderDay() {
    const dayVal = paidDay != null ? String(paidDay) : '';
    const dayHint = paidDay
      ? `✅ Se registrará como PAGADO el día ${paidDay}.`
      : 'Déjalo vacío para registrar como pendiente.';
    return `
      <div class="day-field">
        <input id="py-paid-day" type="number" min="1" max="31" inputmode="numeric" class="input tabular" value="${dayVal}" placeholder="Día del mes" />
        <button type="button" class="btn btn-secondary shrink-0" data-action="today">${ICON.calendar}<span>Hoy</span></button>
      </div>
      <p class="form-hint" id="paid-hint">${dayHint}</p>
    `;
  }

  const body = `
    <form id="form-payment" class="form-stack" novalidate>
      <section class="form-section">
        <div class="form-section-head">
          <span class="step-num">1</span>
          <h3 class="form-section-title">Jugador</h3>
        </div>
        <div id="player-block">${renderPlayerBlock()}</div>
      </section>

      <section class="form-section">
        <div class="form-section-head">
          <span class="step-num">2</span>
          <h3 class="form-section-title">Período</h3>
        </div>
        <div id="period-block">${renderPeriodChips()}</div>
      </section>

      <section class="form-section">
        <div class="form-section-head">
          <span class="step-num">3</span>
          <h3 class="form-section-title">Monto</h3>
        </div>
        <div id="amount-block">${renderAmount()}</div>
      </section>

      <section class="form-section">
        <div class="form-section-head">
          <span class="step-num">4</span>
          <h3 class="form-section-title">Día de pago</h3>
        </div>
        <div id="day-block">${renderDay()}</div>
      </section>

      <div id="summary-block" class="payment-summary">${renderSummary()}</div>

      <p id="py-error" class="form-error" hidden></p>
    </form>
  `;

  function renderSummary() {
    if (!selectedPlayer) {
      return `<p class="summary-empty">Selecciona un jugador para ver el resumen del pago.</p>`;
    }
    const amt = amount != null && amount !== '' ? Number(amount) : 0;
    const periodLabel = `${monthName(selMonth - 1)} ${selYear}`;
    const dayLabel = paidDay != null ? `día ${paidDay}` : 'sin fecha (pendiente)';
    const isPaid = paidDay != null;
    return `
      <div class="summary-row">
        <span class="summary-label">Jugador</span>
        <span class="summary-value">${escapeHTML(selectedPlayer.name)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Período</span>
        <span class="summary-value">${escapeHTML(periodLabel)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Monto</span>
        <span class="summary-value tabular-nums">${escapeHTML(formatMXN(amt))}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Fecha</span>
        <span class="summary-value">${dayLabel}</span>
      </div>
      <div class="summary-status ${isPaid ? 'is-paid' : 'is-pending'}">
        <span class="status-dot ${isPaid ? 'dot-success' : 'dot-warning'}"></span>
        <span>${isPaid ? 'Pagado' : 'Pendiente'}</span>
      </div>
    `;
  }

  const footer = `
    <button type="button" class="btn btn-ghost" data-action="cancel">Cancelar</button>
    <button type="button" class="btn btn-primary" data-action="save">${ICON.check}<span>${editing ? 'Guardar cambios' : 'Registrar pago'}</span></button>
  `;

  const m = openModal({
    title: editing ? 'Editar pago' : 'Registrar pago',
    subtitle: editing ? 'Modifica el monto o la fecha del pago.' : 'Selecciona jugador, mes, monto y día.',
    body,
    footer,
    size: 'lg',
  });

  if (!m?.panel) {
    console.error('[openPaymentForm] modal no abrió');
    return;
  }

  const panel = m.panel;
  const form = panel.querySelector('#form-payment');

  // === Helpers de re-render ===
  function rerenderPlayer() {
    panel.querySelector('#player-block').innerHTML = renderPlayerBlock();
    if (selectedPlayer) attachChangePlayer();
    else attachPlayerSearch();
    rerenderSummary();
  }
  function rerenderChips() {
    panel.querySelector('#period-block').innerHTML = renderPeriodChips();
    attachChips();
    rerenderSummary();
  }
  function rerenderAmount() {
    panel.querySelector('#amount-block').innerHTML = renderAmount();
    const ai = panel.querySelector('#py-amount');
    ai?.addEventListener('input', () => { amount = ai.value === '' ? null : Number(ai.value); rerenderSummary(); });
    rerenderSummary();
  }
  function rerenderDay() {
    panel.querySelector('#day-block').innerHTML = renderDay();
    const di = panel.querySelector('#py-paid-day');
    di?.addEventListener('input', () => { paidDay = di.value === '' ? null : Number(di.value); rerenderDayHint(); rerenderSummary(); });
    panel.querySelector('[data-action="today"]')?.addEventListener('click', () => handleToday());
    rerenderDayHint();
    rerenderSummary();
  }
  function rerenderDayHint() {
    const di = panel.querySelector('#py-paid-day');
    const hint = panel.querySelector('#paid-hint');
    if (!di || !hint) return;
    hint.textContent = di.value
      ? `✅ Se registrará como PAGADO el día ${di.value}.`
      : 'Déjalo vacío para registrar como pendiente.';
  }
  function rerenderSummary() {
    const sb = panel.querySelector('#summary-block');
    if (sb) sb.innerHTML = renderSummary();
  }

  function attachChangePlayer() {
    panel.querySelector('[data-action="change-player"]')?.addEventListener('click', () => {
      selectedPlayer = null;
      amount = null;
      rerenderPlayer();
      rerenderChips();
      rerenderAmount();
      rerenderDay();
      setTimeout(() => panel.querySelector('#py-player-search')?.focus(), 50);
    });
  }

  function selectPlayer(id) {
    const p = state.players.find((x) => x.id === id);
    if (!p) return;
    selectedPlayer = p;
    amount = amountForPlayer(p);
    rerenderPlayer();
    rerenderChips();
    rerenderAmount();
    rerenderDay();
    const search = panel.querySelector('#py-player-search');
    if (search) search.value = '';
  }

  function attachPlayerSearch() {
    const input = panel.querySelector('#py-player-search');
    const list = panel.querySelector('#py-player-list');
    if (!input || !list) return;

    function renderMatches(query) {
      const q = (query || '').toLowerCase().trim();
      const matches = state.players
        .filter((p) => !p.exempt)
        .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.phone || '').toLowerCase().includes(q))
        .slice(0, 50);

      if (matches.length === 0) {
        list.innerHTML = `<li class="player-list-empty">Sin resultados. Crea al jugador primero.</li>`;
        return;
      }
      list.innerHTML = matches.map((p) => `
        <li>
          <button type="button" class="player-list-item" data-action="select-player" data-id="${p.id}">
            <div class="avatar size-sm" style="${avatarGradient(p)}">${escapeHTML(initialsOf(p.name))}</div>
            <div class="flex-1 min-w-0 text-left">
              <p class="pli-name truncate">${escapeHTML(p.name)}</p>
              <p class="pli-meta truncate">${escapeHTML(p.category || 'Sin categoría')} · día ${p.paymentDay}</p>
            </div>
            <span class="pli-amt tabular-nums">${escapeHTML(formatMXN(amountForPlayer(p)))}</span>
          </button>
        </li>
      `).join('');

      list.querySelectorAll('[data-action="select-player"]').forEach((b) => {
        b.addEventListener('click', (e) => {
          e.preventDefault();
          selectPlayer(b.dataset.id);
        });
      });
    }

    input.addEventListener('input', () => renderMatches(input.value));
    input.addEventListener('focus', () => renderMatches(input.value));
    setTimeout(() => renderMatches(''), 0);
  }

  function attachChips() {
    panel.querySelectorAll('.period-chip:not([disabled])').forEach((chip) => {
      chip.addEventListener('click', () => {
        const [y, mo] = chip.dataset.period.split('-').map(Number);
        selYear = y;
        selMonth = mo;
        // Si el día seleccionado no aplica al nuevo mes, reset
        if (paidDay != null) {
          const lastDay = new Date(selYear, selMonth, 0).getDate();
          if (paidDay > lastDay) paidDay = lastDay;
        }
        rerenderChips();
      });
    });
  }

  function handleToday() {
    const t = new Date();
    const isCurrentPeriod = selYear === t.getFullYear() && selMonth === (t.getMonth() + 1);
    paidDay = isCurrentPeriod ? t.getDate() : new Date(selYear, selMonth, 0).getDate();
    rerenderDay();
  }

  function attachInitial() {
    if (selectedPlayer) {
      attachChangePlayer();
    } else {
      attachPlayerSearch();
    }
    attachChips();
    const ai = panel.querySelector('#py-amount');
    ai?.addEventListener('input', () => { amount = ai.value === '' ? null : Number(ai.value); rerenderSummary(); });
    const di = panel.querySelector('#py-paid-day');
    di?.addEventListener('input', () => { paidDay = di.value === '' ? null : Number(di.value); rerenderDayHint(); rerenderSummary(); });
    panel.querySelector('[data-action="today"]')?.addEventListener('click', handleToday);
  }

  function showErr(msg) {
    const el = panel.querySelector('#py-error');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function handleSave() {
    const errEl = panel.querySelector('#py-error');
    if (errEl) errEl.hidden = true;

    if (!selectedPlayer) {
      showErr('Selecciona un jugador');
      panel.querySelector('#py-player-search')?.focus();
      return;
    }
    const amountNum = amount != null && amount !== '' ? Number(amount) : NaN;
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      showErr('Ingresa un monto válido (≥ 0)');
      panel.querySelector('#py-amount')?.focus();
      return;
    }
    if (paidDay != null) {
      if (!Number.isFinite(paidDay) || paidDay < 1 || paidDay > 31) {
        showErr('El día debe estar entre 1 y 31');
        panel.querySelector('#py-paid-day')?.focus();
        return;
      }
      const lastDay = new Date(selYear, selMonth, 0).getDate();
      paidDay = Math.min(paidDay, lastDay);
    }

    const data = {
      playerId: selectedPlayer.id,
      year:      selYear,
      month:     selMonth,
      amount:    amountNum,
      status:    paidDay != null ? 'paid' : 'pending',
      paidDate:  paidDay != null
        ? `${selYear}-${String(selMonth).padStart(2, '0')}-${String(paidDay).padStart(2, '0')}`
        : null,
    };

    const saveBtn = panel.querySelector('[data-action="save"]');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span><span>Guardando…</span>';
    }
    try {
      if (editing) {
        await payments.update(editing.id, data);
        toast('Pago actualizado', 'success');
      } else {
        await payments.add(data);
        toast('Pago registrado', 'success');
      }
      m.close();
    } catch (err) {
      console.error('[openPaymentForm] save error', err);
      toast('Error al guardar', 'error');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `${ICON.check}<span>${editing ? 'Guardar cambios' : 'Registrar pago'}</span>`;
      }
    }
  }

  // === Un solo handler delegado para todos los clicks del modal ===
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'cancel') m.close();
    else if (action === 'save') handleSave();
  });

  // === Submit del form (Enter en cualquier input) ===
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSave();
  });

  attachInitial();
}

// === EXPORTAR ===

function exportData(format) {
  const filtered = applyFilter(state.payments, _filter);
  const columns = ['Jugador', 'Categoría', 'Año', 'Mes', 'Monto', 'Estado', 'Fecha de pago'];
  const rows = filtered.map((p) => {
    const pl = state.players.find((x) => x.id === p.playerId);
    return [
      pl?.name || '—',
      pl?.category || '—',
      p.year,
      monthName(Number(p.month) - 1),
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
        Mes: monthName(Number(p.month) - 1),
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
