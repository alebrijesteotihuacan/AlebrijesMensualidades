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

// === FORMULARIO PAGO (UX mejorada: búsqueda, chips de período, contexto) ===

export function openPaymentForm(id, preSelectedPlayerId = null) {
  const editing = id ? state.payments.find((p) => p.id === id) : null;
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // Estado de selección (cambia cuando el usuario busca y elige jugador)
  let selectedPlayer = editing
    ? state.players.find((p) => p.id === editing.playerId)
    : (preSelectedPlayerId ? state.players.find((p) => p.id === preSelectedPlayerId) : null);

  // Estado del período seleccionado (year, month)
  let selYear  = editing?.year  ?? currentYear;
  let selMonth = editing?.month ?? currentMonth;

  // Genera los 6 chips de meses: 3 atrás + actual + 2 adelante
  function buildMonthChips() {
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
      const label = `${monthShort(realM - 1)} ${yAbs !== currentYear ? `'${String(yAbs).slice(-2)}` : ''}`;
      chips.push({ y: yAbs, m: realM, label, isPaid });
    }
    return chips;
  }

  function renderPlayerBlock() {
    if (selectedPlayer) {
      return `
        <div class="selected-player">
          <div class="avatar size-md" style="${avatarGradient(selectedPlayer)}">${escapeHTML(initialsOf(selectedPlayer.name))}</div>
          <div class="flex-1 min-w-0">
            <p class="sp-name truncate">${escapeHTML(selectedPlayer.name)}</p>
            <p class="sp-meta">${escapeHTML(selectedPlayer.category || 'Sin categoría')} · día ${selectedPlayer.paymentDay} · ${escapeHTML(formatMXN(amountForPlayer(selectedPlayer)))}</p>
          </div>
          <button type="button" data-change-player class="btn btn-ghost btn-sm">Cambiar</button>
        </div>
      `;
    }
    return `
      <div class="combobox">
        <input id="py-player-search" type="text" autocomplete="off" placeholder="Buscar jugador por nombre o teléfono..." class="input" />
        <ul id="py-player-dropdown" class="combobox-dropdown" role="listbox" hidden></ul>
      </div>
    `;
  }

  function renderPeriodChips() {
    const chips = buildMonthChips();
    return `
      <div class="period-chips" role="radiogroup" aria-label="Mes del pago">
        ${chips.map((c) => `
          <button type="button"
            class="period-chip ${(c.y === selYear && c.m === selMonth) ? 'is-active' : ''} ${c.isPaid ? 'is-paid' : ''}"
            data-period="${c.y}-${c.m}"
            ${c.isPaid ? 'disabled title="Este mes ya está pagado"' : ''}
            role="radio"
            aria-checked="${(c.y === selYear && c.m === selMonth)}">
            ${c.isPaid ? '<span class="pc-tick">✓</span>' : ''}${escapeHTML(c.label)}
          </button>
        `).join('')}
      </div>
    `;
  }

  const initialDay = editing?.paidDate ? Number(editing.paidDate.slice(8, 10)) : '';
  const initialAmount = editing?.amount ?? (selectedPlayer ? amountForPlayer(selectedPlayer) : '');

  const body = `
    <form id="form-payment" class="flex flex-col gap-5" novalidate>
      <div>
        <div class="step-label"><span class="step-num">1</span><span>Jugador</span></div>
        <div id="player-block">${renderPlayerBlock()}</div>
      </div>

      <div>
        <div class="step-label"><span class="step-num">2</span><span>Período</span></div>
        <div id="period-block">${renderPeriodChips()}</div>
      </div>

      <div>
        <div class="step-label"><span class="step-num">3</span><span>Monto</span></div>
        <input id="py-amount" name="amount" type="number" min="0" step="50" required inputmode="numeric" class="input tabular" value="${initialAmount}" placeholder="0" />
        <p class="form-hint" id="amount-hint">${selectedPlayer ? `Mensualidad sugerida: ${escapeHTML(formatMXN(amountForPlayer(selectedPlayer)))}` : 'Selecciona un jugador para sugerir monto'}</p>
      </div>

      <div>
        <div class="step-label"><span class="step-num">4</span><span>Día de pago</span></div>
        <div class="flex items-center gap-2">
          <input id="py-paid-day" name="paidDay" type="number" min="1" max="31" inputmode="numeric" class="input tabular" value="${initialDay}" placeholder="Ej. 15" />
          <button type="button" data-today class="btn btn-secondary shrink-0">Hoy</button>
        </div>
        <p class="form-hint" id="paid-hint">Déjalo vacío si el pago aún no se realiza (queda pendiente).</p>
      </div>

      <p id="py-error" class="form-error" hidden></p>
    </form>
  `;

  const footer = `
    <button type="button" data-cancel class="btn btn-secondary">Cancelar</button>
    <button type="button" data-save class="btn btn-primary">${editing ? 'Guardar cambios' : 'Registrar pago'}</button>
  `;

  const m = openModal({
    title: editing ? 'Editar pago' : 'Registrar pago',
    body,
    footer,
    size: 'lg',
  });

  if (!m?.panel) {
    console.error('[openPaymentForm] No se pudo abrir el modal');
    return;
  }

  const panel = m.panel;

  // === Helpers ===
  function updateAmountHint() {
    const hint = panel.querySelector('#amount-hint');
    if (!hint) return;
    hint.textContent = selectedPlayer
      ? `Mensualidad sugerida: ${formatMXN(amountForPlayer(selectedPlayer))}`
      : 'Selecciona un jugador para sugerir monto';
  }

  function repaintPlayer() {
    panel.querySelector('#player-block').innerHTML = renderPlayerBlock();
    if (selectedPlayer) attachChangePlayer();
    else attachSearch();
    updateAmountHint();
  }

  function repaintChips() {
    panel.querySelector('#period-block').innerHTML = renderPeriodChips();
    attachChips();
  }

  // === Selección de jugador ===
  function attachChangePlayer() {
    panel.querySelector('[data-change-player]')?.addEventListener('click', () => {
      selectedPlayer = null;
      repaintPlayer();
      repaintChips();
      const amtIn = panel.querySelector('[name=amount]');
      if (amtIn && !editing) amtIn.value = '';
      setTimeout(() => panel.querySelector('#py-player-search')?.focus(), 50);
    });
  }

  function selectPlayer(id) {
    const p = state.players.find((x) => x.id === id);
    if (!p) return;
    selectedPlayer = p;
    const amtIn = panel.querySelector('[name=amount]');
    if (amtIn && !amtIn.value && !editing) amtIn.value = amountForPlayer(p);
    repaintPlayer();
    repaintChips();
    const input = panel.querySelector('#py-player-search');
    if (input) input.value = '';
    setTimeout(() => panel.querySelector('[name=amount]')?.focus(), 50);
  }

  function attachSearch() {
    const input = panel.querySelector('#py-player-search');
    const dropdown = panel.querySelector('#py-player-dropdown');
    if (!input || !dropdown) return;

    let highlightedIdx = -1;

    function getMatches(query) {
      const q = (query || '').toLowerCase().trim();
      return state.players
        .filter((p) => !p.exempt)
        .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.phone || '').toLowerCase().includes(q))
        .slice(0, 8);
    }

    function render(query) {
      const matches = getMatches(query);
      highlightedIdx = matches.length > 0 ? 0 : -1;
      if (matches.length === 0) {
        dropdown.innerHTML = `<li class="combobox-empty">Sin resultados</li>`;
      } else {
        dropdown.innerHTML = matches.map((p, i) => `
          <li class="combobox-item ${i === highlightedIdx ? 'is-highlighted' : ''}" data-id="${p.id}" role="option">
            <div class="avatar size-sm" style="${avatarGradient(p)}">${escapeHTML(initialsOf(p.name))}</div>
            <div class="flex-1 min-w-0">
              <p class="ci-name truncate">${escapeHTML(p.name)}</p>
              <p class="ci-meta">${escapeHTML(p.category || '—')} · día ${p.paymentDay}</p>
            </div>
            <span class="ci-amt">${escapeHTML(formatMXN(amountForPlayer(p)))}</span>
          </li>
        `).join('');
        dropdown.querySelectorAll('li[data-id]').forEach((li) => {
          li.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectPlayer(li.dataset.id);
          });
          li.addEventListener('mouseenter', () => {
            highlightedIdx = [...dropdown.querySelectorAll('li[data-id]')].indexOf(li);
            updateHighlight();
          });
        });
      }
      dropdown.hidden = false;
    }

    function updateHighlight() {
      dropdown.querySelectorAll('li[data-id]').forEach((li, i) => {
        li.classList.toggle('is-highlighted', i === highlightedIdx);
      });
    }

    function closeDropdown() { dropdown.hidden = true; }

    input.addEventListener('input', () => { render(input.value); });
    input.addEventListener('focus', () => render(input.value));
    input.addEventListener('keydown', (e) => {
      const items = [...dropdown.querySelectorAll('li[data-id]')];
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIdx = Math.min(highlightedIdx + 1, items.length - 1);
        updateHighlight();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIdx = Math.max(highlightedIdx - 1, 0);
        updateHighlight();
      } else if (e.key === 'Enter') {
        if (highlightedIdx >= 0 && items[highlightedIdx]) {
          e.preventDefault();
          selectPlayer(items[highlightedIdx].dataset.id);
        }
      } else if (e.key === 'Escape') {
        closeDropdown();
      }
    });

    // Cerrar al hacer click fuera (instalado una sola vez por sesión del form)
    const onDocMouseDown = (e) => {
      if (!panel.contains(e.target)) closeDropdown();
    };
    setTimeout(() => document.addEventListener('mousedown', onDocMouseDown), 0);
    m._cleanup = () => document.removeEventListener('mousedown', onDocMouseDown);
  }

  // === Período (chips) ===
  function attachChips() {
    panel.querySelectorAll('.period-chip:not([disabled])').forEach((chip) => {
      chip.addEventListener('click', () => {
        const [y, mo] = chip.dataset.period.split('-').map(Number);
        selYear = y;
        selMonth = mo;
        panel.querySelectorAll('.period-chip').forEach((c) => {
          const [cy, cm] = c.dataset.period.split('-').map(Number);
          c.classList.toggle('is-active', cy === y && cm === mo);
        });
      });
    });
  }

  // === Botón Hoy ===
  panel.querySelector('[data-today]')?.addEventListener('click', () => {
    const t = new Date();
    const isCurrentPeriod = selYear === t.getFullYear() && selMonth === (t.getMonth() + 1);
    let day;
    if (isCurrentPeriod) {
      day = t.getDate();
    } else {
      day = new Date(selYear, selMonth, 0).getDate();
    }
    const dayIn = panel.querySelector('[name=paidDay]');
    if (dayIn) {
      dayIn.value = String(day);
      dayIn.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // === Hint del día ===
  function syncPaidHint() {
    const dayIn = panel.querySelector('[name=paidDay]');
    const hint = panel.querySelector('#paid-hint');
    if (!dayIn || !hint) return;
    hint.textContent = dayIn.value
      ? '✅ Se registrará como PAGADO en esa fecha.'
      : 'Déjalo vacío si el pago aún no se realiza (queda pendiente).';
  }
  panel.querySelector('[name=paidDay]')?.addEventListener('input', syncPaidHint);
  syncPaidHint();

  // === Init ===
  if (selectedPlayer) {
    attachChangePlayer();
    attachChips();
  } else {
    attachSearch();
    attachChips();
    setTimeout(() => panel.querySelector('#py-player-search')?.focus(), 100);
  }

  // === Cancelar / Guardar ===
  panel.querySelector('[data-cancel]')?.addEventListener('click', () => m.close());
  panel.querySelector('[data-save]')?.addEventListener('click', async () => {
    const errEl = panel.querySelector('#py-error');
    if (errEl) errEl.hidden = true;

    if (!selectedPlayer) {
      showErr('Selecciona un jugador'); return;
    }
    const amountIn = panel.querySelector('[name=amount]');
    const dayIn    = panel.querySelector('[name=paidDay]');

    const amountNum = Number(amountIn?.value);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      showErr('Monto inválido'); amountIn?.focus(); return;
    }

    const dayVal = (dayIn?.value || '').trim();
    let paidDate = null;
    if (dayVal !== '') {
      const d = Number(dayVal);
      if (!Number.isFinite(d) || d < 1 || d > 31) {
        showErr('El día debe estar entre 1 y 31'); dayIn?.focus(); return;
      }
      const lastDay = new Date(selYear, selMonth, 0).getDate();
      const safeDay = Math.min(d, lastDay);
      paidDate = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
    }

    const data = {
      playerId: selectedPlayer.id,
      year:      selYear,
      month:     selMonth,
      amount:    amountNum,
      status:    paidDate ? 'paid' : 'pending',
      paidDate,
    };

    const saveBtn = panel.querySelector('[data-save]');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando…'; }

    try {
      if (editing) {
        await payments.update(editing.id, data);
        toast('Pago actualizado', 'success');
      } else {
        await payments.add(data);
        toast('Pago registrado', 'success');
      }
      m.close();
    } catch (e) {
      console.error('[openPaymentForm] save error', e);
      toast('Error al guardar', 'error');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = editing ? 'Guardar cambios' : 'Registrar pago';
      }
    }

    function showErr(msg) {
      if (!errEl) return;
      errEl.textContent = msg;
      errEl.hidden = false;
    }
  });

  // === Limpieza al cerrar ===
  const _origClose = m.close;
  m.close = () => {
    try { m._cleanup && m._cleanup(); } catch (_) {}
    _origClose();
  };
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
