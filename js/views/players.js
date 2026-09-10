// js/views/players.js
// Vista Jugadores: cards minimalistas, planas, monocromas.

import { state, toast, openModal, openDrawer, confirmModal, escapeHTML, ICON, avatarGradient, openMessageMenu, amountForPlayer, findCategoryByName, toWhatsAppUrl } from '../app.js';
import { players, payments } from '../services/firestore.js';
import { daysOverdue, formatMXN, formatDate, monthName } from '../utils/dates.js';
import { getAutoPendingPeriod } from '../services/autoPending.js';
import { openPaymentForm } from './payments.js';

let _filter = { category: '', status: '', dayRange: '', search: '' };

export function renderPlayers(root) {
  root.innerHTML = `
    <section class="flex flex-col gap-6">
      <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p class="section-eyebrow">Plantilla</p>
          <h1 class="section-title text-2xl sm:text-3xl mt-1">Jugadores</h1>
        </div>
        <button id="btn-new-player" type="button" class="btn btn-primary">
          ${ICON.plus}<span>Nuevo jugador</span>
        </button>
      </header>

      <!-- Toolbar -->
      <div class="card card-pad flex flex-col gap-4">
        <!-- Search bar (prominente) -->
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/>
          </svg>
          <input id="f-search" type="search" placeholder="Buscar por nombre o teléfono…" class="input pl-10 pr-10" autocomplete="off" aria-label="Buscar jugador" />
          <button id="f-search-clear" type="button" class="absolute right-2 top-1/2 -translate-y-1/2 icon-btn h-7 w-7" aria-label="Limpiar búsqueda" hidden>
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          </button>
        </div>

        <!-- Filtros secundarios + botón limpiar (alineados a la derecha) -->
        <div class="flex flex-col sm:flex-row sm:items-end gap-2.5">
          <div class="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label class="label" for="f-category">Categoría</label>
              <select id="f-category" class="select">
                <option value="">Todas</option>
                ${state.categories.map((c) => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="label" for="f-dayrange">Día de pago</label>
              <select id="f-dayrange" class="select">
                <option value="">Todos</option>
                <option value="1-14">1 al 14</option>
                <option value="15-31">15 al 31</option>
              </select>
            </div>
            <div>
              <label class="label" for="f-status">Estado</label>
              <select id="f-status" class="select">
                <option value="">Todos</option>
                <option value="paid">Al día</option>
                <option value="pending">Pendientes</option>
                <option value="adeudo">Con adeudo</option>
              </select>
            </div>
          </div>
          <button id="f-clear" type="button" class="btn btn-secondary shrink-0" disabled>
            <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
            <span>Limpiar filtros</span>
          </button>
        </div>
      </div>

      <!-- Result counter + active filter chips -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div id="players-count" class="flex items-baseline gap-1.5"></div>
        <div id="active-chips" class="flex flex-wrap items-center gap-1.5"></div>
      </div>

      <!-- Grid -->
      <div id="players-grid"></div>
    </section>
  `;

  const grid      = root.querySelector('#players-grid');
  const countEl   = root.querySelector('#players-count');
  const chipsEl   = root.querySelector('#active-chips');
  const search    = root.querySelector('#f-search');
  const searchX   = root.querySelector('#f-search-clear');
  const catSel    = root.querySelector('#f-category');
  const daySel    = root.querySelector('#f-dayrange');
  const staSel    = root.querySelector('#f-status');
  const clear     = root.querySelector('#f-clear');
  const btnNew    = root.querySelector('#btn-new-player');

  search.value = _filter.search;
  catSel.value = _filter.category;
  daySel.value = _filter.dayRange;
  staSel.value = _filter.status;
  searchX.hidden = !_filter.search;

  search.addEventListener('input',  (e) => {
    _filter.search = e.target.value.toLowerCase().trim();
    searchX.hidden = !_filter.search;
    paint();
  });
  searchX.addEventListener('click', () => {
    _filter.search = '';
    search.value = '';
    searchX.hidden = true;
    search.focus();
    paint();
  });
  catSel.addEventListener('change', (e) => { _filter.category = e.target.value; paint(); });
  daySel.addEventListener('change', (e) => { _filter.dayRange = e.target.value; paint(); });
  staSel.addEventListener('change', (e) => { _filter.status   = e.target.value; paint(); });
  clear.addEventListener('click', () => {
    _filter = { category: '', status: '', dayRange: '', search: '' };
    search.value = ''; searchX.hidden = true;
    catSel.value = ''; daySel.value = ''; staSel.value = '';
    paint();
    search.focus();
  });
  btnNew.addEventListener('click', () => openPlayerForm(null));

  function isFilterActive() {
    return Boolean(_filter.search || _filter.category || _filter.dayRange || _filter.status);
  }

  function paint() {
    const playersWithStatus = state.players.map(playerWithCurrentStatus);
    const filtered = applyFilter(playersWithStatus, _filter);

    const total   = playersWithStatus.length;
    const paid    = playersWithStatus.filter((p) => p.status === 'paid').length;
    const pending = playersWithStatus.filter((p) => p.status === 'pending').length;
    const adeudo  = playersWithStatus.filter((p) => p.status === 'adeudo').length;

    // Result counter
    const showing = filtered.length;
    const hasFilters = isFilterActive();
    if (total === 0) {
      countEl.innerHTML = `<p class="text-sm text-zinc-500">Sin jugadores registrados.</p>`;
    } else {
      countEl.innerHTML = hasFilters
        ? `<p class="text-sm text-zinc-700">
             Mostrando <span class="font-semibold tabular-nums text-zinc-950">${showing}</span>
             de <span class="font-semibold tabular-nums text-zinc-950">${total}</span>
             jugador${total === 1 ? '' : 'es'}
           </p>`
        : `<p class="text-sm text-zinc-700">
             <span class="font-semibold tabular-nums text-zinc-950">${total}</span>
             jugador${total === 1 ? '' : 'es'} en plantilla
           </p>
           <span class="text-xs text-zinc-500 hidden sm:inline">·</span>
           <div class="hidden sm:flex flex-wrap items-center gap-2.5 text-xs text-zinc-500 tabular-nums">
             <span class="inline-flex items-center gap-1"><span class="status-dot dot-success"></span>${paid} al día</span>
             ${pending > 0 ? `<span class="inline-flex items-center gap-1"><span class="status-dot dot-warning"></span>${pending} pendientes</span>` : ''}
             ${adeudo > 0 ? `<span class="inline-flex items-center gap-1"><span class="status-dot dot-danger"></span>${adeudo} con adeudo</span>` : ''}
           </div>`;
    }

    // Active filter chips
    clear.disabled = !hasFilters;
    chipsEl.innerHTML = hasFilters ? activeChipsHTML() : '';

    if (filtered.length === 0) {
      grid.innerHTML = state.players.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon">${ICON.users}</div>
            <p class="font-semibold">Aún no hay jugadores</p>
            <p class="text-sm text-zinc-500 mt-1">Crea el primero con el botón "Nuevo jugador".</p>
          </div>`
        : `<div class="empty-state">
            <div class="empty-state-icon">
              <svg viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/></svg>
            </div>
            <p class="font-semibold">Sin resultados</p>
            <p class="text-sm text-zinc-500 mt-1">Ningún jugador coincide con los filtros aplicados.</p>
            <button type="button" id="empty-clear" class="btn btn-secondary btn-sm mt-3">
              <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
              <span>Limpiar filtros</span>
            </button>
          </div>`;
      const emptyClear = root.querySelector('#empty-clear');
      if (emptyClear) emptyClear.addEventListener('click', () => clear.click());
      return;
    }

    grid.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        ${filtered.map(playerCard).join('')}
      </div>
    `;

    grid.querySelectorAll('[data-player]').forEach((el) => {
      el.addEventListener('click', () => openPlayerDrawer(el.dataset.player));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPlayerDrawer(el.dataset.player);
        }
      });
    });

    // Wire chips (remove individual filter)
    chipsEl.querySelectorAll('[data-remove-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.removeFilter;
        _filter[key] = '';
        if (key === 'category') catSel.value = '';
        if (key === 'dayRange') daySel.value = '';
        if (key === 'status')   staSel.value = '';
        if (key === 'search')   { search.value = ''; searchX.hidden = true; }
        paint();
      });
    });
  }

  function activeChipsHTML() {
    const items = [];
    if (_filter.search) {
      const txt = _filter.search.length > 24 ? _filter.search.slice(0, 22) + '…' : _filter.search;
      items.push(filterChip('search', `“${escapeHTML(txt)}”`));
    }
    if (_filter.category) items.push(filterChip('category', escapeHTML(_filter.category)));
    if (_filter.dayRange) items.push(filterChip('dayRange', `Día ${_filter.dayRange.replace('-', ' al ')}`));
    if (_filter.status)   items.push(filterChip('status', statusLabel(_filter.status)));
    return items.join('');
  }

  function filterChip(key, label) {
    return `
      <span class="filter-chip">
        <span>${label}</span>
        <button type="button" data-remove-filter="${key}" class="filter-chip-x" aria-label="Quitar filtro ${escapeHTML(label)}">
          <svg viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3" aria-hidden="true"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </button>
      </span>
    `;
  }

  function statusLabel(s) {
    if (s === 'paid')    return 'Al día';
    if (s === 'pending') return 'Pendientes';
    if (s === 'adeudo')  return 'Con adeudo';
    return s;
  }

  paint();
}

function playerWithCurrentStatus(p) {
  if (p.exempt) return { ...p, status: 'paid', payment: null, diasAdeudo: 0 };
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const payment = state.payments.find((pay) =>
    pay.playerId === p.id &&
    Number(pay.year) === year &&
    Number(pay.month) === month
  );

  // Fuente única de verdad para el estado: getAutoPendingPeriod considera
  // mes actual + alerta + mes previo (si la alerta aún no llega) + mes siguiente.
  const period = getAutoPendingPeriod(p, state.payments, today);

  let status = 'paid';
  let dias = 0;

  if (period) {
    if (period.year === year && period.month === month) {
      // Pendiente del mes actual
      if (period.isOverdue) {
        status = 'adeudo';
        dias = Math.abs(period.daysUntilDue);
      } else {
        status = 'pending';
        dias = 0;
      }
    } else {
      // Pendiente de mes pasado (sin pagar) → adeudo
      // Pendiente de mes siguiente (ya pagó este) → paid
      if (period.isOverdue) {
        status = 'adeudo';
        dias = Math.abs(period.daysUntilDue);
      } else {
        status = 'paid';
        dias = 0;
      }
    }
  }

  return { ...p, status, payment: payment || null, diasAdeudo: dias };
}

function applyFilter(list, { category, status, dayRange, search }) {
  return list
    .filter((p) => !category || p.category === category)
    .filter((p) => !status   || p.status   === status)
    .filter((p) => {
      if (!dayRange) return true;
      const day = Number(p.paymentDay);
      if (!Number.isFinite(day)) return true;
      const [from, to] = dayRange.split('-').map(Number);
      return day >= from && day <= to;
    })
    .filter((p) => {
      if (!search) return true;
      const hay = `${p.name} ${p.phone || ''}`.toLowerCase();
      return hay.includes(search);
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function playerCard(p) {
  const amount = formatMXN(amountForPlayer(p));
  return `
    <article class="player-card" data-status="${p.status}" data-player="${p.id}" role="button" tabindex="0" aria-label="Ver información de ${escapeHTML(p.name)}">
      <!-- Header -->
      <div class="flex items-start gap-3">
        <div class="avatar size-lg" style="${avatarGradient(p)}" aria-hidden="true">${escapeHTML(initialsOf(p.name))}</div>
        <div class="min-w-0 flex-1">
          <h3 class="player-name truncate">${escapeHTML(p.name)}</h3>
          <p class="player-meta truncate">${escapeHTML(p.category || 'Sin categoría')}</p>
          <div class="mt-1.5">${statusInline(p)}</div>
        </div>
        <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 text-zinc-400 shrink-0" aria-hidden="true"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
      </div>

      <!-- Info row -->
      <div class="flex items-center justify-between text-sm border-t border-zinc-100 pt-3">
        <div>
          <p class="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Día pago</p>
          ${p.exempt
            ? `<p class="font-semibold text-xs">Becado</p>`
            : `<p class="font-semibold tabular-nums">${p.paymentDay}</p>`}
        </div>
        <div class="text-right">
          <p class="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Mensualidad</p>
          <p class="player-amount">${amount}</p>
        </div>
      </div>

      ${p.notes ? `<p class="text-xs text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-md px-2.5 py-2 leading-relaxed line-clamp-2">${escapeHTML(p.notes)}</p>` : ''}
    </article>
  `;
}

function statusInline(p) {
  if (p.exempt) return `<span class="status"><span class="status-dot dot-neutral"></span><span>Becado</span></span>`;
  if (p.status === 'paid')    return `<span class="status"><span class="status-dot dot-success"></span><span>Al día</span></span>`;
  if (p.status === 'pending') return `<span class="status"><span class="status-dot dot-warning"></span><span>Pendiente hoy</span></span>`;
  // Adeudo: el texto "No podrá entrenar" SOLO aparece cuando el jugador
  // ya no puede entrenar (>= 5 días de atraso). Para 1-4 días se muestra
  // una etiqueta más neutra ("Adeudo") con los días.
  const dias = daysOverdue(p);
  const noEntrena = dias >= 5;
  const dot = noEntrena ? 'dot-danger' : 'dot-warning';
  const label = noEntrena ? 'No podrá entrenar' : 'Adeudo';
  return `<span class="status"><span class="status-dot ${dot}"></span><span>${label} · ${dias}d</span></span>`;
}

function initialsOf(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
}

// === DRAWER DE JUGADOR ===

function paymentRow(pay) {
  const mes = monthName(Number(pay.month) - 1);
  const periodo = `${mes} ${pay.year}`;
  const isPaid = pay.status === 'paid';
  const dot = isPaid ? 'dot-success' : 'dot-warning';
  const statusText = isPaid ? 'Pagado' : 'Pendiente';
  return `
    <div class="flex items-center gap-3 px-3 py-2.5">
      <span class="status-dot ${dot}"></span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium truncate">${escapeHTML(periodo)}</p>
        <p class="text-xs text-zinc-500">${isPaid && pay.paidDate ? escapeHTML(formatDate(pay.paidDate)) : '—'}</p>
      </div>
      <span class="text-sm font-semibold tabular-nums">${escapeHTML(formatMXN(pay.amount))}</span>
    </div>
  `;
}

function openPlayerDrawer(id) {
  const p = state.players.find((x) => x.id === id);
  if (!p) return;
  const amount = formatMXN(amountForPlayer(p));
  const cat = findCategoryByName(p.category);
  const dias = daysOverdue(p);
  const isOverdue = p.status === 'adeudo';

  const body = `
    <div class="flex items-center gap-3 mb-4">
      <div class="avatar size-lg" style="${avatarGradient(p)}" aria-hidden="true">${escapeHTML(initialsOf(p.name))}</div>
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-base truncate">${escapeHTML(p.name)}</p>
        <p class="text-xs text-zinc-500 truncate">${escapeHTML(p.category || 'Sin categoría')}</p>
      </div>
    </div>

    <div>${statusInline(p)}</div>

    <div class="mt-5">
      <div class="detail-row">
        <span class="detail-label">Mensualidad</span>
        <span class="detail-value tabular-nums">${amount}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Día de pago</span>
        <span class="detail-value tabular-nums">${p.exempt ? 'Becado' : p.paymentDay}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Categoría</span>
        <span class="detail-value">${escapeHTML(p.category || '—')}</span>
      </div>
      ${p.phone ? `
        <div class="detail-row">
          <span class="detail-label">Teléfono</span>
          <a href="${toWhatsAppUrl(p.phone)}" target="_blank" rel="noopener noreferrer" class="detail-value font-mono text-zinc-700 hover:text-zinc-950 inline-flex items-center gap-1.5">
            ${ICON.whatsapp}<span>${escapeHTML(p.phone)}</span>
          </a>
        </div>` : ''}
      ${isOverdue && dias > 0 ? `
        <div class="detail-row">
          <span class="detail-label">Atraso</span>
          <span class="detail-value text-danger tabular-nums">${dias} ${dias === 1 ? 'día' : 'días'}</span>
        </div>` : ''}
    </div>

    ${p.notes ? `
      <div class="mt-5">
        <p class="text-[10px] uppercase tracking-wider font-medium text-zinc-500 mb-1.5">Notas</p>
        <p class="text-sm text-zinc-700 bg-zinc-50 border border-zinc-100 rounded-md px-3 py-2 leading-relaxed">${escapeHTML(p.notes)}</p>
      </div>` : ''}

    ${(() => {
      const pays = state.payments
        .filter((pay) => pay.playerId === p.id)
        .sort((a, b) => (Number(b.year) - Number(a.year)) || (Number(b.month) - Number(a.month)));
      return `
        <div class="mt-5">
          <div class="flex items-center justify-between mb-2">
            <p class="text-[10px] uppercase tracking-wider font-medium text-zinc-500">Historial de pagos</p>
            <span class="text-xs text-zinc-500 tabular-nums">${pays.length}</span>
          </div>
          ${pays.length === 0
            ? `<p class="text-sm text-zinc-500 bg-zinc-50 border border-zinc-100 rounded-md px-3 py-3 text-center">Sin pagos registrados.</p>`
            : `<div class="border border-zinc-100 rounded-md divide-y divide-zinc-100">${pays.map(paymentRow).join('')}</div>`}
        </div>
      `;
    })()}
  `;

  const footer = `
    ${!p.exempt ? `
      <button data-pay type="button" class="btn btn-primary w-full justify-center">
        ${ICON.plus}<span>Registrar pago</span>
      </button>
      <button data-msg type="button" class="btn btn-secondary w-full justify-center" ${p.status === 'paid' ? 'disabled' : ''}>
        ${ICON.chat}<span>Copiar mensaje de pago</span>
      </button>` : ''}
    <div class="grid grid-cols-2 gap-2">
      <button data-edit type="button" class="btn btn-secondary w-full justify-center">
        ${ICON.edit}<span>Editar</span>
      </button>
      <button data-del type="button" class="btn btn-ghost w-full justify-center text-red-600 hover:bg-red-50">
        ${ICON.trash}<span>Eliminar</span>
      </button>
    </div>
  `;

  const drawer = openDrawer({ title: 'Detalles del jugador', body, footer });
  if (!drawer.panel) return;

  drawer.panel.querySelector('[data-edit]')?.addEventListener('click', () => {
    drawer.close();
    openPlayerForm(p.id);
  });
  drawer.panel.querySelector('[data-del]')?.addEventListener('click', async () => {
    drawer.close();
    await onDelete(p.id);
  });
  drawer.panel.querySelector('[data-msg]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    openMessageMenu(btn, p, { amount: amountForPlayer(p) });
  });
  drawer.panel.querySelector('[data-pay]')?.addEventListener('click', () => {
    drawer.close();
    openPaymentForm(null, p.id);
  });
}

// === FORMULARIO CREAR/EDITAR ===

function openPlayerForm(id) {
  const editing = id ? state.players.find((p) => p.id === id) : null;
  const cats = state.categories;
  const isEdit = Boolean(editing);

  // Estado mutable (para previews en vivo)
  let data = {
    name:        editing?.name ?? '',
    category:    editing?.category ?? '',
    phone:       editing?.phone ?? '',
    paymentDay:  editing?.paymentDay ?? 1,
    customAmount: editing?.customAmount ?? '',
    exempt:      editing?.exempt ?? false,
    notes:       editing?.notes ?? '',
  };

  function avatarPreview() {
    const name = (data.name || '?').trim() || '?';
    const seed = name + (data.category || '');
    const pal = avatarGradient(seed);
    const initials = String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
    return `<div class="avatar size-xl" style="${pal}" aria-hidden="true">${escapeHTML(initials)}</div>`;
  }

  function categoryOptions() {
    return cats.map((c) => `
      <button type="button"
        class="cat-card ${data.category === c.name ? 'is-selected' : ''}"
        data-action="select-category"
        data-cat="${escapeHTML(c.name)}">
        <span class="cat-card-name">${escapeHTML(c.name)}</span>
        <span class="cat-card-amt tabular-nums">${escapeHTML(formatMXN(c.amount))}</span>
      </button>
    `).join('');
  }

  function dayChips() {
    const options = [1, 5, 10, 15, 20, 25, 28];
    return options.map((d) => `
      <button type="button"
        class="day-chip ${data.paymentDay === d ? 'is-active' : ''}"
        data-action="select-day"
        data-day="${d}">${d}</button>
    `).join('');
  }

  function previewBlock() {
    if (!data.name.trim()) {
      return `<p class="preview-empty">Vista previa del jugador</p>`;
    }
    const catObj = cats.find((c) => c.name === data.category);
    const monthly = data.customAmount !== '' && data.customAmount != null
      ? Number(data.customAmount)
      : (catObj ? Number(catObj.amount) : 0);
    return `
      <div class="player-preview">
        ${avatarPreview()}
        <div class="flex-1 min-w-0">
          <p class="preview-name truncate">${escapeHTML(data.name)}</p>
          <p class="preview-meta truncate">${escapeHTML(data.category || 'Sin categoría')}${data.exempt ? ' · Becado' : ` · día ${data.paymentDay} · ${escapeHTML(formatMXN(monthly))}/mes`}</p>
        </div>
      </div>
    `;
  }

  function body() {
    return `
      <form id="form-player" class="form-stack" novalidate>
        <section class="form-section">
          <div class="form-section-head">
            <span class="step-num">1</span>
            <h3 class="form-section-title">Identidad</h3>
          </div>
          <div class="form-grid">
            <div class="form-grid-full">
              <label class="label" for="pf-name">Nombre completo *</label>
              <input id="pf-name" name="name" type="text" required autocomplete="off" class="input" placeholder="Ej. Juan Pérez" value="${escapeHTML(data.name)}" data-sync="name" />
            </div>
            <div>
              <label class="label" for="pf-phone">Teléfono (WhatsApp)</label>
              <input id="pf-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" class="input" placeholder="55 1234 5678" value="${escapeHTML(data.phone)}" data-sync="phone" />
              <p class="form-hint">Para enviar mensajes de pago.</p>
            </div>
            <div>
              <label class="label" for="pf-day-input">Día de pago *</label>
              <input id="pf-day-input" name="paymentDay" type="number" min="1" max="31" required class="input tabular" value="${data.paymentDay}" data-sync="paymentDay" />
              <p class="form-hint">Día del mes (1-31).</p>
            </div>
          </div>
          <div class="day-chips" role="group" aria-label="Días comunes">${dayChips()}</div>
        </section>

        <section class="form-section">
          <div class="form-section-head">
            <span class="step-num">2</span>
            <h3 class="form-section-title">Categoría</h3>
          </div>
          ${cats.length === 0
            ? `<p class="form-hint">No hay categorías. <a href="#/categories" class="underline">Crear una primero</a>.</p>`
            : `<div class="cat-cards">${categoryOptions()}</div>
               <input type="hidden" name="category" value="${escapeHTML(data.category)}" data-sync="category" />`
          }
        </section>

        <section class="form-section">
          <div class="form-section-head">
            <span class="step-num">3</span>
            <h3 class="form-section-title">Monto personalizado (opcional)</h3>
          </div>
          <div class="amount-field">
            <span class="amount-prefix">$</span>
            <input id="pf-custom" name="customAmount" type="number" min="0" step="50" inputmode="numeric" class="input tabular amount-input" placeholder="0" value="${data.customAmount === '' || data.customAmount == null ? '' : data.customAmount}" data-sync="customAmount" />
            <span class="amount-suffix">MXN</span>
          </div>
          <p class="form-hint">Si lo dejas vacío, se usa el monto de la categoría.</p>
        </section>

        <section class="form-section">
          <div class="form-section-head">
            <span class="step-num">4</span>
            <h3 class="form-section-title">Detalles</h3>
          </div>
          <label class="switch-row" for="pf-exempt">
            <div class="flex-1">
              <p class="switch-title">Jugador becado o exento</p>
              <p class="switch-sub">No genera cobros automáticos.</p>
            </div>
            <span class="switch-track ${data.exempt ? 'is-on' : ''}">
              <input id="pf-exempt" type="checkbox" name="exempt" ${data.exempt ? 'checked' : ''} data-sync="exempt" />
              <span class="switch-knob"></span>
            </span>
          </label>
          <div class="form-grid form-grid-full" style="margin-top: 12px;">
            <div class="form-grid-full">
              <label class="label" for="pf-notes">Notas</label>
              <textarea id="pf-notes" name="notes" rows="2" class="textarea" placeholder="Información adicional (tutor, alergias, comentarios…)" data-sync="notes">${escapeHTML(data.notes)}</textarea>
            </div>
          </div>
        </section>

        <section class="form-section form-section--preview">
          <div class="form-section-head">
            <span class="step-num" aria-hidden="true">👁</span>
            <h3 class="form-section-title">Vista previa</h3>
          </div>
          <div id="preview-block">${previewBlock()}</div>
        </section>

        <p id="pf-error" class="form-error" hidden></p>
      </form>
    `;
  }

  const footer = `
    <button type="button" class="btn btn-ghost" data-action="cancel">Cancelar</button>
    <button type="submit" class="btn btn-primary" form="form-player">
      <span>${isEdit ? 'Guardar cambios' : 'Crear jugador'}</span>
    </button>
  `;

  const m = openModal({
    title: isEdit ? 'Editar jugador' : 'Nuevo jugador',
    subtitle: isEdit ? 'Modifica los datos del jugador.' : 'Da de alta un jugador. Paso 1: identidad. Paso 2: categoría.',
    body: body(),
    footer,
    size: 'lg',
  });

  if (!m?.panel) {
    console.error('[openPlayerForm] modal no abrió');
    return;
  }
  const panel = m.panel;
  const form = panel.querySelector('#form-player');

  // === Sync inputs → estado ===
  form.addEventListener('input', (e) => {
    const t = e.target;
    const key = t.dataset.sync;
    if (!key) return;
    if (t.type === 'checkbox') data[key] = t.checked;
    else if (t.type === 'number') data[key] = t.value === '' ? '' : Number(t.value);
    else data[key] = t.value;
    updatePreview();
    // Si cambió categoría → refrescar las cards (para el is-selected)
    if (key === 'category') refreshCategoryCards();
    // Si cambió el día → refrescar chips
    if (key === 'paymentDay') refreshDayChips();
  });

  function updatePreview() {
    const block = panel.querySelector('#preview-block');
    if (block) block.innerHTML = previewBlock();
  }
  function refreshCategoryCards() {
    const cards = panel.querySelector('.cat-cards');
    if (cards) cards.innerHTML = categoryOptions();
  }
  function refreshDayChips() {
    const chips = panel.querySelector('.day-chips');
    if (chips) chips.innerHTML = dayChips();
  }

  // === Click handler delegado ===
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'cancel') { m.close(); return; }
    if (action === 'select-category') {
      data.category = btn.dataset.cat;
      const hidden = form.querySelector('[name=category]');
      if (hidden) hidden.value = data.category;
      refreshCategoryCards();
      updatePreview();
      return;
    }
    if (action === 'select-day') {
      const d = Number(btn.dataset.day);
      data.paymentDay = d;
      const di = form.querySelector('[name=paymentDay]');
      if (di) di.value = String(d);
      refreshDayChips();
      updatePreview();
      return;
    }
  });

  // === Submit del form (Enter) ===
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSave();
  });

  function showErr(msg) {
    const el = panel.querySelector('#pf-error');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function handleSave() {
    const errEl = panel.querySelector('#pf-error');
    if (errEl) errEl.hidden = true;

    const name = (data.name || '').trim();
    const category = (data.category || '').trim();
    const day = Number(data.paymentDay);

    if (!name) { showErr('El nombre es obligatorio'); return; }
    if (!category) { showErr('Selecciona una categoría'); return; }
    if (!Number.isFinite(day) || day < 1 || day > 31) {
      showErr('El día de pago debe estar entre 1 y 31'); return;
    }
    const customRaw = data.customAmount;
    if (customRaw !== '' && customRaw != null && (Number(customRaw) < 0 || !Number.isFinite(Number(customRaw)))) {
      showErr('El monto personalizado no es válido'); return;
    }

    const payload = {
      name,
      category,
      phone:       (data.phone || '').trim(),
      notes:       (data.notes || '').trim(),
      paymentDay:  day,
      customAmount: customRaw === '' || customRaw == null ? null : Number(customRaw),
      exempt:      Boolean(data.exempt),
    };

    const saveBtn = panel.querySelector('button[type=submit][form="form-player"]');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span><span>Guardando…</span>';
    }

    try {
      if (isEdit) {
        await players.update(editing.id, payload);
        toast('Jugador actualizado', 'success');
      } else {
        await players.add(payload);
        toast('Jugador creado', 'success');
      }
      m.close();
    } catch (err) {
      console.error('[openPlayerForm] save error', err);
      toast('Error al guardar: ' + (err?.message || err), 'error');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<span>${isEdit ? 'Guardar cambios' : 'Crear jugador'}</span>`;
      }
    }
  }
}

async function onDelete(id) {
  const p = state.players.find((x) => x.id === id);
  if (!p) return;
  const ok = await confirmModal({
    title: 'Eliminar jugador',
    message: `¿Eliminar a "${p.name}"? También se eliminarán sus pagos asociados.`,
    confirmText: 'Eliminar',
    danger: true,
  });
  if (!ok) return;
  try {
    const related = state.payments.filter((pay) => pay.playerId === id);
    await Promise.all(related.map((pay) => payments.remove(pay.id)));
    await players.remove(id);
    toast('Jugador eliminado', 'success');
  } catch (err) {
    console.error(err);
    toast('Error al eliminar', 'error');
  }
}
