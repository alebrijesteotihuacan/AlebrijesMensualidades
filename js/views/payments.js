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
            <button data-pay="${p.id}" type="button" class="btn btn-primary btn-sm"><span>Marcar pagado</span></button>
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

// === FORMULARIO PAGO (versión ultra-simple: select + form submit) ===

export function openPaymentForm(id, preSelectedPlayerId = null) {
  try {
    const editing = id ? state.payments.find((p) => p.id === id) : null;
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    // Jugador (puede venir pre-seleccionado desde el drawer)
    const initialPlayer = editing
      ? state.players.find((p) => p.id === editing.playerId)
      : (preSelectedPlayerId ? state.players.find((p) => p.id === preSelectedPlayerId) : null);

    const playersList = state.players
      .filter((p) => !p.exempt)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    // Genera los 6 chips de meses: 3 atrás + actual + 2 adelante
    const monthChips = [];
    for (let i = -3; i <= 2; i++) {
      const mAbs = currentMonth + i;
      const yAbs = currentYear + Math.floor((mAbs - 1) / 12);
      const realM = ((mAbs - 1) % 12 + 12) % 12 + 1;
      const playerId = initialPlayer?.id || '';
      const isPaid = playerId ? state.payments.some((pay) =>
        pay.playerId === playerId &&
        Number(pay.year) === yAbs &&
        Number(pay.month) === realM &&
        pay.status === 'paid'
      ) : false;
      const isCurrent = realM === currentMonth && yAbs === currentYear;
      const label = isCurrent ? 'Este mes' : `${monthShort(realM - 1)}${yAbs !== currentYear ? ` '${String(yAbs).slice(-2)}` : ''}`;
      monthChips.push({ y: yAbs, m: realM, label, isPaid, isCurrent });
    }

    const selYear  = Number(editing?.year  ?? currentYear);
    const selMonth = Number(editing?.month ?? currentMonth);
    const initDay  = editing?.paidDate ? Number(editing.paidDate.slice(8, 10)) : '';
    const initAmt  = editing?.amount ?? (initialPlayer ? amountForPlayer(initialPlayer) : '');

    // === HTML del body ===
    const body = `
      <form id="payment-form" class="form-stack" novalidate>
        ${initialPlayer ? `
          <section class="form-section">
            <div class="form-section-head">
              <span class="step-num">1</span>
              <h3 class="form-section-title">Jugador</h3>
            </div>
            <div class="player-picker is-selected" style="cursor:default;">
              <div class="avatar size-md" style="${avatarGradient(initialPlayer)}">${escapeHTML(initialsOf(initialPlayer.name))}</div>
              <div class="flex-1 min-w-0 text-left">
                <p class="pp-name truncate">${escapeHTML(initialPlayer.name)}</p>
                <p class="pp-meta truncate">${escapeHTML(initialPlayer.category || 'Sin categoría')} · día ${initialPlayer.paymentDay} · ${escapeHTML(formatMXN(amountForPlayer(initialPlayer)))}/mes</p>
              </div>
            </div>
            <input type="hidden" name="playerId" value="${escapeHTML(initialPlayer.id)}" />
          </section>
        ` : `
          <section class="form-section">
            <div class="form-section-head">
              <span class="step-num">1</span>
              <h3 class="form-section-title">Jugador</h3>
            </div>
            <select name="playerId" class="select" required>
              <option value="">Selecciona un jugador…</option>
              ${playersList.map((p) => `
                <option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} — ${escapeHTML(p.category || 'Sin categoría')} · ${escapeHTML(formatMXN(amountForPlayer(p)))}</option>
              `).join('')}
            </select>
          </section>
        `}

        <section class="form-section">
          <div class="form-section-head">
            <span class="step-num">2</span>
            <h3 class="form-section-title">Período</h3>
          </div>
          <div class="period-chips" role="radiogroup" aria-label="Mes del pago">
            ${monthChips.map((c) => `
              <label class="period-chip ${(c.y === selYear && c.m === selMonth) ? 'is-active' : ''} ${c.isPaid ? 'is-paid' : ''}">
                <input type="radio" name="period" value="${c.y}-${c.m}" ${(c.y === selYear && c.m === selMonth) ? 'checked' : ''} ${c.isPaid ? 'disabled' : ''} />
                <span>${escapeHTML(c.label)}</span>
              </label>
            `).join('')}
          </div>
        </section>

        <section class="form-section">
          <div class="form-section-head">
            <span class="step-num">3</span>
            <h3 class="form-section-title">Monto</h3>
          </div>
          <div class="amount-field">
            <span class="amount-prefix">$</span>
            <input name="amount" type="number" min="0" step="50" inputmode="numeric" required class="input tabular amount-input" value="${initAmt !== '' ? initAmt : ''}" placeholder="0" />
            <span class="amount-suffix">MXN</span>
          </div>
          ${initialPlayer ? `<p class="form-hint">Mensualidad: ${escapeHTML(formatMXN(amountForPlayer(initialPlayer)))}</p>` : ''}
        </section>

        <section class="form-section">
          <div class="form-section-head">
            <span class="step-num">4</span>
            <h3 class="form-section-title">Día de pago (opcional)</h3>
          </div>
          <div class="day-field">
            <input name="paidDay" type="number" min="1" max="31" inputmode="numeric" class="input tabular" value="${initDay !== '' ? initDay : ''}" placeholder="Déjalo vacío si aún no paga" />
            <button type="button" class="btn btn-secondary shrink-0" data-action="today">
              ${ICON.calendar}<span>Hoy</span>
            </button>
          </div>
          <p class="form-hint">Si lo dejas vacío, el pago queda como <strong>pendiente</strong>.</p>
        </section>

        <div id="py-error" class="form-error" hidden></div>
      </form>
    `;

    // === Footer: submit real ===
    const footer = `
      <button type="button" class="btn btn-ghost" data-action="cancel">Cancelar</button>
      <button type="submit" class="btn btn-primary" form="payment-form">
        <span>${editing ? 'Guardar cambios' : 'Registrar pago'}</span>
      </button>
    `;

    const m = openModal({
      title: editing ? 'Editar pago' : 'Registrar pago',
      subtitle: editing ? 'Modifica el monto o la fecha del pago.' : 'Llena los datos del pago y presiona Registrar.',
      body,
      footer,
      size: 'lg',
    });

    if (!m?.panel) {
      console.error('[openPaymentForm] modal no abrió');
      toast('No se pudo abrir el formulario', 'error');
      return;
    }

    const panel = m.panel;
    const form  = panel.querySelector('#payment-form');

    // === Botón "Hoy": completa el día ===
    panel.querySelector('[data-action="today"]')?.addEventListener('click', () => {
      const pd = panel.querySelector('input[name=paidDay]');
      if (pd) {
        pd.value = String(todayDay);
        pd.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // === Cancelar ===
    panel.querySelector('[data-action="cancel"]')?.addEventListener('click', () => m.close());

    // === Submit del form (botón submit o Enter) ===
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      handleSave();
    });

    async function handleSave() {
      const errEl = panel.querySelector('#py-error');
      const showErr = (msg) => {
        if (!errEl) { alert(msg); return; }
        errEl.textContent = msg;
        errEl.hidden = false;
        errEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };

      if (errEl) errEl.hidden = true;

      const fd = new FormData(form);
      const playerId = String(fd.get('playerId') || '').trim();
      const periodVal = String(fd.get('period') || '');
      const amountStr = String(fd.get('amount') || '').trim();
      const dayStr = String(fd.get('paidDay') || '').trim();

      if (!playerId) { showErr('Selecciona un jugador'); return; }
      if (!periodVal) { showErr('Selecciona el período'); return; }
      const amountNum = Number(amountStr);
      if (!Number.isFinite(amountNum) || amountNum < 0) {
        showErr('Ingresa un monto válido (mayor o igual a 0)'); return;
      }
      let paidDay = null;
      if (dayStr !== '') {
        const d = Number(dayStr);
        if (!Number.isFinite(d) || d < 1 || d > 31) {
          showErr('El día debe estar entre 1 y 31'); return;
        }
        paidDay = d;
      }

      const [yStr, mStr] = periodVal.split('-');
      const year  = Number(yStr);
      const month = Number(mStr);
      if (!Number.isFinite(year) || !Number.isFinite(month)) { showErr('Período inválido'); return; }
      const lastDay = new Date(year, month, 0).getDate();
      const safeDay = paidDay != null ? Math.min(paidDay, lastDay) : null;

      const data = {
        playerId,
        year,
        month,
        amount: amountNum,
        status: safeDay != null ? 'paid' : 'pending',
        paidDate: safeDay != null ? `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}` : null,
      };

      const saveBtn = panel.querySelector('button[type=submit][form="payment-form"]');
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
        toast('Error al guardar: ' + (err?.message || err), 'error');
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = editing ? 'Guardar cambios' : 'Registrar pago';
        }
      }
    }
  } catch (err) {
    console.error('[openPaymentForm] error', err);
    toast('Error al abrir el formulario', 'error');
  }
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
