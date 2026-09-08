// js/views/payments.js
// Vista de Pagos: tabla en desktop, cards en mobile. Filtros colapsables.

import { state, toast, openModal, confirmModal, escapeHTML, ICON, avatarGradient, amountForPlayer } from '../app.js';
import { payments } from '../services/firestore.js';
import { classifyMora, moraLabel } from '../services/mora.js';
import { renderMessage, copyToClipboard, BANK_INFO } from '../services/messages.js';
import { formatMXN, formatDate, getCurrentQuincena, quincenaLabel } from '../utils/dates.js';
import { toCSV, toPDF } from '../services/export.js';

let _filter = { playerId: '', year: '', quincena: '', status: '' };

export function renderPayments(root) {
  const current = getCurrentQuincena();

  root.innerHTML = `
    <section class="flex flex-col gap-5">
      <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p class="section-eyebrow">Cobranza</p>
          <h1 class="font-display font-extrabold text-3xl sm:text-4xl uppercase tracking-tight">Pagos</h1>
          <p class="muted text-sm mt-1">${escapeHTML(quincenaLabel(current.year, current.quincena))} · Período actual</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button id="btn-clabe" type="button" class="btn btn-steel">${ICON.bank}<span>Datos bancarios</span></button>
          <button id="btn-new-payment" type="button" class="btn btn-primary">${ICON.plus}<span>Nuevo pago</span></button>
        </div>
      </header>

      <!-- Filtros -->
      <details class="card card-pad" id="filters-card">
        <summary class="flex items-center justify-between cursor-pointer list-none">
          <div class="flex items-center gap-3">
            <span class="section-eyebrow">Filtros</span>
            <span id="filter-count" class="badge badge-neutral">0 activos</span>
          </div>
          <span class="text-ink-500 text-sm">${ICON.chevronDown}</span>
        </summary>
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
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
          <div class="col-span-2 lg:col-span-5 flex flex-wrap gap-2 justify-end">
            <button id="f-clear" type="button" class="btn btn-ghost">Limpiar</button>
            <button id="btn-export-csv" type="button" class="btn btn-secondary">Exportar CSV</button>
            <button id="btn-export-pdf" type="button" class="btn btn-secondary">Exportar PDF</button>
          </div>
        </div>
      </details>

      <!-- Lista / Tabla -->
      <div id="payments-table"></div>
    </section>
  `;

  const playerSel  = root.querySelector('#f-player');
  const yearSel    = root.querySelector('#f-year');
  const quincenaSel= root.querySelector('#f-quincena');
  const statusSel  = root.querySelector('#f-status');
  const clear      = root.querySelector('#f-clear');
  const filterCount = root.querySelector('#filter-count');

  playerSel.value   = _filter.playerId;
  yearSel.value     = _filter.year;
  quincenaSel.value = _filter.quincena;
  statusSel.value   = _filter.status;

  playerSel.addEventListener('change',   (e) => { _filter.playerId   = e.target.value; paint(); updateFilterCount(); });
  yearSel.addEventListener('change',     (e) => { _filter.year       = e.target.value; paint(); updateFilterCount(); });
  quincenaSel.addEventListener('change', (e) => { _filter.quincena   = e.target.value; paint(); updateFilterCount(); });
  statusSel.addEventListener('change',   (e) => { _filter.status     = e.target.value; paint(); updateFilterCount(); });
  clear.addEventListener('click', () => {
    _filter = { playerId: '', year: '', quincena: '', status: '' };
    playerSel.value = yearSel.value = quincenaSel.value = statusSel.value = '';
    paint();
    updateFilterCount();
  });

  function updateFilterCount() {
    const n = Object.values(_filter).filter(Boolean).length;
    filterCount.textContent = `${n} ${n === 1 ? 'activo' : 'activos'}`;
  }
  updateFilterCount();

  root.querySelector('#btn-new-payment').addEventListener('click', () => openPaymentForm(null));
  root.querySelector('#btn-clabe').addEventListener('click', () => openClabeModal());
  root.querySelector('#btn-export-csv').addEventListener('click', () => exportData('csv'));
  root.querySelector('#btn-export-pdf').addEventListener('click', () => exportData('pdf'));

  paint();

  function paint() {
    const wrap = root.querySelector('#payments-table');
    const filtered = applyFilter(state.payments, _filter)
      .sort((a, b) => (b.year - a.year) || (b.quincena - a.quincena) || (a.playerName || '').localeCompare(b.playerName || ''));

    if (filtered.length === 0) {
      wrap.innerHTML = `<div class="empty-state">
          <div class="empty-state-icon mx-auto">${ICON.cash}</div>
          <p class="font-display font-extrabold text-xl uppercase">Sin pagos registrados</p>
          <p class="muted text-sm mt-1">Crea el primer pago con el botón "Nuevo pago".</p>
        </div>`;
      return;
    }

    wrap.innerHTML = `
      <!-- Mobile: cards -->
      <div class="md:hidden flex flex-col gap-3">
        ${filtered.map(rowCard).join('')}
      </div>

      <!-- Desktop: tabla -->
      <div class="hidden md:block table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Categoría</th>
              <th>Período</th>
              <th>Monto</th>
              <th>Estado</th>
              <th>Pagado</th>
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
  const statusBadge = isPending
    ? `<span class="badge ${level === 'mora5' ? 'badge-mora' : level === 'mora3' ? 'badge-mora' : level === 'mora1' ? 'badge-pending' : 'badge-info'}">${escapeHTML(moraLabel(level || 'recordatorio'))}</span>`
    : `<span class="badge badge-paid">${ICON.check}<span>Pagado</span></span>`;

  return `
    <tr>
      <td>
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="player-avatar shrink-0" style="${avatarGradient(playerName)}">${escapeHTML(initialsOf(playerName))}</div>
          <span class="font-bold truncate">${escapeHTML(playerName)}</span>
        </div>
      </td>
      <td><span class="tag">${escapeHTML(playerCat)}</span></td>
      <td class="tabular">${escapeHTML(quincenaLabel(p.year, p.quincena))}</td>
      <td class="font-bold tabular">${formatMXN(p.amount)}</td>
      <td>${statusBadge}</td>
      <td class="text-xs muted tabular">${p.paidDate ? formatDate(p.paidDate) : '—'}</td>
      <td class="text-right">
        <div class="inline-flex gap-1">
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

function rowCard(p) {
  const player = state.players.find((pl) => pl.id === p.playerId);
  const playerName = player?.name || '—';
  const playerCat  = player?.category || '—';
  const isPending  = p.status === 'pending';
  const level      = isPending && player ? classifyMora(player) : null;
  const statusBadge = isPending
    ? `<span class="badge ${level === 'mora5' ? 'badge-mora' : level === 'mora3' ? 'badge-mora' : level === 'mora1' ? 'badge-pending' : 'badge-info'}">${escapeHTML(moraLabel(level || 'recordatorio'))}</span>`
    : `<span class="badge badge-paid">${ICON.check}<span>Pagado</span></span>`;

  return `
    <article class="pay-card">
      <div class="pay-card-row">
        <div class="flex items-center gap-3 min-w-0">
          <div class="player-avatar" style="${avatarGradient(playerName)}">${escapeHTML(initialsOf(playerName))}</div>
          <div class="min-w-0">
            <p class="pay-card-name truncate">${escapeHTML(playerName)}</p>
            <p class="player-meta truncate">${escapeHTML(playerCat)}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="font-display font-extrabold text-lg tabular-nums leading-none">${formatMXN(p.amount)}</p>
          <p class="text-[10px] uppercase tracking-widest font-bold text-ink-500 mt-1">${escapeHTML(quincenaLabel(p.year, p.quincena))}</p>
        </div>
      </div>
      <div class="pay-card-row">
        <div class="flex flex-wrap items-center gap-2">
          ${statusBadge}
          ${p.paidDate ? `<span class="tag">${escapeHTML(formatDate(p.paidDate))}</span>` : ''}
        </div>
        <div class="flex gap-1">
          ${isPending ? `
            <button data-copy="${p.id}" type="button" class="icon-btn" aria-label="Copiar mensaje">${ICON.copy}</button>
            <button data-pay="${p.id}" type="button" class="btn btn-primary btn-sm">${ICON.check}<span>Pagado</span></button>
          ` : ''}
          <button data-edit="${p.id}" type="button" class="icon-btn" aria-label="Editar pago">${ICON.edit}</button>
          <button data-del="${p.id}" type="button" class="icon-btn icon-btn-danger" aria-label="Eliminar pago">${ICON.trash}</button>
        </div>
      </div>
    </article>
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
    confirmText: 'Sí, eliminar',
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

  const body = `
    <form id="form-payment" class="grid grid-cols-1 sm:grid-cols-2 gap-4" novalidate>
      <div class="sm:col-span-2">
        <label class="label" for="py-player">Jugador *</label>
        <select id="py-player" name="playerId" required class="select">
          <option value="">Selecciona…</option>
          ${state.players.map((pl) => `<option value="${pl.id}" ${editing?.playerId === pl.id ? 'selected' : ''}>${escapeHTML(pl.name)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="label" for="py-year">Año *</label>
        <input id="py-year" name="year" type="number" min="2020" max="2099" required inputmode="numeric" class="input tabular" value="${editing?.year ?? current.year}" />
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
      <div>
        <label class="label" for="py-status">Estado *</label>
        <select id="py-status" name="status" required class="select">
          <option value="pending" ${editing?.status !== 'paid' ? 'selected' : ''}>Pendiente</option>
          <option value="paid"    ${editing?.status === 'paid' ? 'selected' : ''}>Pagado</option>
        </select>
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="py-paid">Fecha de pago</label>
        <input id="py-paid" name="paidDate" type="date" class="input tabular" value="${editing?.paidDate ?? ''}" />
      </div>
      <p id="py-error" class="sm:col-span-2 form-error" hidden></p>
    </form>
  `;

  const footer = `
    <button data-cancel type="button" class="btn btn-secondary">Cancelar</button>
    <button data-save type="button" class="btn btn-primary">${editing ? 'Guardar cambios' : 'Crear pago'}</button>
  `;

  const m = openModal({ title: editing ? 'Editar pago' : 'Nuevo pago', body, footer, size: 'lg' });

  const form      = m.panel.querySelector('#form-payment');
  const playerSel = form.querySelector('[name=playerId]');
  const amountIn  = form.querySelector('[name=amount]');
  const quincenaSel = form.querySelector('[name=quincena]');
  const hint      = m.panel.querySelector('#amount-hint');

  function syncFromPlayer() {
    const pl = state.players.find((x) => x.id === playerSel.value);
    if (pl) {
      const amt = amountForPlayer(pl);
      if (!amountIn.value) amountIn.value = amt;
      const expectedQ = Number(pl.paymentDay) <= 15 ? 1 : 2;
      quincenaSel.value = String(expectedQ);
      hint.textContent = `Monto: ${formatMXN(amt)} · Día ${pl.paymentDay} → Q${expectedQ}`;
    } else {
      hint.textContent = 'Selecciona jugador para autocompletar';
    }
  }
  playerSel.addEventListener('change', () => { amountIn.value = ''; syncFromPlayer(); });
  syncFromPlayer();

  m.panel.querySelector('[data-cancel]').addEventListener('click', m.close);
  m.panel.querySelector('[data-save]').addEventListener('click', async () => {
    const errEl = m.panel.querySelector('#py-error');
    errEl.hidden = true;

    if (!playerSel.value) {
      showErr('Selecciona un jugador'); playerSel.focus(); return;
    }
    if (!form.year.value || Number(form.year.value) < 2020) {
      showErr('Año inválido'); form.year.focus(); return;
    }
    if (!amountIn.value || Number(amountIn.value) < 0) {
      showErr('Monto inválido'); amountIn.focus(); return;
    }

    const data = {
      playerId: playerSel.value,
      year:      Number(form.year.value),
      quincena:  Number(quincenaSel.value),
      amount:    Number(amountIn.value),
      status:    form.status.value,
      paidDate:  form.paidDate.value || null,
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

// === MODAL CLABE ===

function openClabeModal() {
  const body = `
    <div class="flex flex-col gap-4 items-center">
      <img src="assets/clabe.png" alt="Datos de transferencia" class="w-full max-w-md rounded-lg border border-ink-200" />
      <dl class="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-sm">
        <div class="card card-pad sm:col-span-1"><dt class="text-[10px] uppercase tracking-widest font-bold muted">Banco</dt><dd class="font-bold">${escapeHTML(BANK_INFO.banco)}</dd></div>
        <div class="card card-pad sm:col-span-2"><dt class="text-[10px] uppercase tracking-widest font-bold muted">Titular</dt><dd class="font-bold">${escapeHTML(BANK_INFO.titular)}</dd></div>
        <div class="card card-pad sm:col-span-3"><dt class="text-[10px] uppercase tracking-widest font-bold muted">CLABE Interbancaria</dt>
          <dd class="font-mono font-bold tracking-wide">${escapeHTML(BANK_INFO.clabe)}</dd>
        </div>
        <div class="card card-pad sm:col-span-3"><dt class="text-[10px] uppercase tracking-widest font-bold muted">Concepto</dt><dd class="font-bold">${escapeHTML(BANK_INFO.concepto)}</dd></div>
      </dl>
    </div>
  `;
  const footer = `
    <button data-copy-clabe type="button" class="btn btn-secondary">${ICON.copy}<span>Copiar CLABE</span></button>
    <button data-close type="button" class="btn btn-primary">Cerrar</button>
  `;
  const m = openModal({ title: 'Datos de transferencia', body, footer, size: 'lg' });
  m.panel.querySelector('[data-close]').addEventListener('click', m.close);
  m.panel.querySelector('[data-copy-clabe]').addEventListener('click', async () => {
    await copyToClipboard(BANK_INFO.clabe);
    toast('CLABE copiada', 'success');
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
