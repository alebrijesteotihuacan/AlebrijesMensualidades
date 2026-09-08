// js/views/payments.js
// Vista de Pagos: tabla con filtros, marcar pagado, copiar mensaje, ver CLABE.

import { state, toast, openModal, confirmModal, escapeHTML, amountForPlayer } from '../app.js';
import { payments } from '../services/firestore.js';
import { classifyMora, moraBadgeClass, moraLabel } from '../services/mora.js';
import { renderMessage, copyToClipboard, BANK_INFO } from '../services/messages.js';
import { formatMXN, formatDate, getCurrentQuincena, quincenaLabel } from '../utils/dates.js';
import { toCSV, toPDF } from '../services/export.js';

let _filter = { playerId: '', year: '', quincena: '', status: '' };

export function renderPayments(root) {
  const current = getCurrentQuincena();

  root.innerHTML = `
    <section class="flex flex-col gap-6">
      <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 class="font-display font-extrabold text-2xl sm:text-3xl">Pagos</h1>
          <p class="muted text-sm">${quincenaLabel(current.year, current.quincena)} · Período actual</p>
        </div>
        <div class="flex gap-2">
          <button id="btn-clabe" class="btn-secondary">
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z"/></svg>
            Datos de pago
          </button>
          <button id="btn-new-payment" class="btn-primary">
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/></svg>
            Nuevo pago
          </button>
        </div>
      </header>

      <!-- Filtros -->
      <div class="card card-pad grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div class="col-span-2 lg:col-span-2">
          <label class="label">Jugador</label>
          <select id="f-player" class="select">
            <option value="">Todos</option>
            ${state.players.map((p) => `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="label">Año</label>
          <select id="f-year" class="select">
            <option value="">Todos</option>
            ${[...new Set(state.payments.map((p) => p.year))].sort((a,b) => b-a).map((y) => `<option value="${y}">${y}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="label">Quincena</label>
          <select id="f-quincena" class="select">
            <option value="">Todas</option>
            <option value="1">Q1 (1-15)</option>
            <option value="2">Q2 (16-31)</option>
          </select>
        </div>
        <div>
          <label class="label">Estado</label>
          <select id="f-status" class="select">
            <option value="">Todos</option>
            <option value="paid">Pagado</option>
            <option value="pending">Pendiente</option>
          </select>
        </div>
        <div class="col-span-2 lg:col-span-5 flex flex-wrap gap-2 justify-end">
          <button id="f-clear" class="btn-ghost">Limpiar</button>
          <button id="btn-export-csv"  class="btn-secondary">Exportar CSV</button>
          <button id="btn-export-pdf"  class="btn-secondary">Exportar PDF</button>
        </div>
      </div>

      <!-- Tabla -->
      <div id="payments-table"></div>
    </section>
  `;

  // Wire filtros
  const playerSel  = root.querySelector('#f-player');
  const yearSel    = root.querySelector('#f-year');
  const quincenaSel= root.querySelector('#f-quincena');
  const statusSel  = root.querySelector('#f-status');
  const clear      = root.querySelector('#f-clear');

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
  root.querySelector('#btn-clabe').addEventListener('click', () => openClabeModal());
  root.querySelector('#btn-export-csv').addEventListener('click', () => exportData('csv'));
  root.querySelector('#btn-export-pdf').addEventListener('click', () => exportData('pdf'));

  paint();

  function paint() {
    const wrap = root.querySelector('#payments-table');
    const filtered = applyFilter(state.payments, _filter)
      .sort((a, b) => (b.year - a.year) || (b.quincena - a.quincena) || (a.playerName || '').localeCompare(b.playerName || ''));

    if (filtered.length === 0) {
      wrap.innerHTML = `<div class="card card-pad text-center"><p class="font-semibold">Sin pagos registrados</p><p class="muted text-sm">Crea el primer pago con el botón "Nuevo pago".</p></div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Jugador</th>
              <th class="hidden sm:table-cell">Categoría</th>
              <th>Período</th>
              <th>Monto</th>
              <th>Estado</th>
              <th class="hidden md:table-cell">Pagado</th>
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
    wrap.querySelectorAll('[data-view-clabe]').forEach((b) => b.addEventListener('click', () => openClabeModal(b.dataset.viewClabe)));
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
    ? `<span class="${moraBadgeClass(level || 'recordatorio')}">${moraLabel(level || 'recordatorio')}</span>`
    : `<span class="badge badge-paid">Pagado</span>`;

  return `
    <tr>
      <td>
        <div class="font-semibold">${escapeHTML(playerName)}</div>
        <div class="text-xs muted sm:hidden">${escapeHTML(playerCat)}</div>
      </td>
      <td class="hidden sm:table-cell">${escapeHTML(playerCat)}</td>
      <td>${quincenaLabel(p.year, p.quincena)}</td>
      <td class="font-bold">${formatMXN(p.amount)}</td>
      <td>${statusBadge}</td>
      <td class="hidden md:table-cell text-xs muted">${p.paidDate ? formatDate(p.paidDate) : '—'}</td>
      <td>
        <div class="flex justify-end gap-1">
          ${isPending ? `
            <button data-copy="${p.id}" class="btn-ghost btn-sm" title="Copiar mensaje">
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z"/><path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/></svg>
              Copiar
            </button>
            <button data-pay="${p.id}" class="btn-primary btn-sm">
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              Pagado
            </button>
          ` : ''}
          <button data-edit="${p.id}" class="btn-ghost btn-sm" title="Editar">
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
          </button>
          <button data-del="${p.id}" class="btn-ghost btn-sm text-red-600 hover:bg-red-50" title="Eliminar">
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `;
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
  } catch (e) {
    console.error(e);
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
    <form id="form-payment" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="sm:col-span-2">
        <label class="label">Jugador *</label>
        <select name="playerId" required class="select">
          <option value="">Selecciona…</option>
          ${state.players.map((pl) => `<option value="${pl.id}" ${editing?.playerId === pl.id ? 'selected' : ''}>${escapeHTML(pl.name)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="label">Año *</label>
        <input name="year" type="number" min="2020" max="2099" required class="input" value="${editing?.year ?? current.year}" />
      </div>
      <div>
        <label class="label">Quincena *</label>
        <select name="quincena" required class="select">
          <option value="1" ${(editing?.quincena ?? current.quincena) === 1 ? 'selected' : ''}>Q1 (1-15)</option>
          <option value="2" ${(editing?.quincena ?? current.quincena) === 2 ? 'selected' : ''}>Q2 (16-31)</option>
        </select>
        <p class="text-xs muted mt-1">Se autodefine según el día de pago del jugador.</p>
      </div>
      <div>
        <label class="label">Monto (MXN) *</label>
        <input name="amount" type="number" min="0" step="50" required class="input" value="${editing?.amount ?? ''}" />
        <p class="text-xs muted mt-1" id="amount-hint">Selecciona jugador para autocompletar</p>
      </div>
      <div>
        <label class="label">Estado *</label>
        <select name="status" required class="select">
          <option value="pending" ${editing?.status !== 'paid' ? 'selected' : ''}>Pendiente</option>
          <option value="paid"    ${editing?.status === 'paid' ? 'selected' : ''}>Pagado</option>
        </select>
      </div>
      <div>
        <label class="label">Fecha de pago</label>
        <input name="paidDate" type="date" class="input" value="${editing?.paidDate ?? ''}" />
      </div>
    </form>
  `;

  const footer = `
    <button data-cancel class="btn-secondary">Cancelar</button>
    <button data-save class="btn-primary">${editing ? 'Guardar cambios' : 'Crear pago'}</button>
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
      // Autodefine quincena segun paymentDay (1-15 -> Q1, 16-31 -> Q2)
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
    if (!form.reportValidity()) return;
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
  });
}

// === MODAL CLABE ===

function openClabeModal() {
  const body = `
    <div class="flex flex-col gap-4 items-center">
      <img src="assets/clabe.png" alt="Datos de transferencia" class="w-full max-w-md rounded-xl border border-ink-200" />
      <dl class="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-sm">
        <div class="card card-pad sm:col-span-1"><dt class="text-xs muted">Banco</dt><dd class="font-bold">${escapeHTML(BANK_INFO.banco)}</dd></div>
        <div class="card card-pad sm:col-span-2"><dt class="text-xs muted">Titular</dt><dd class="font-bold">${escapeHTML(BANK_INFO.titular)}</dd></div>
        <div class="card card-pad sm:col-span-3"><dt class="text-xs muted">CLABE Interbancaria</dt>
          <dd class="font-mono font-bold tracking-wide">${escapeHTML(BANK_INFO.clabe)}</dd>
        </div>
        <div class="card card-pad sm:col-span-3"><dt class="text-xs muted">Concepto</dt><dd class="font-bold">${escapeHTML(BANK_INFO.concepto)}</dd></div>
      </dl>
    </div>
  `;
  const footer = `
    <button data-copy-clabe class="btn-secondary">
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z"/><path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/></svg>
      Copiar CLABE
    </button>
    <button data-close class="btn-primary">Cerrar</button>
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
