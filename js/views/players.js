// js/views/players.js
// Vista de Jugadores: grid de tarjetas con identidad Alebrije.

import { state, toast, openModal, confirmModal, escapeHTML, ICON, avatarGradient, openMessageMenu, findCategoryByName, amountForPlayer } from '../app.js';
import { players, payments } from '../services/firestore.js';
import { classifyMora, moraLabel } from '../services/mora.js';
import { daysMora, formatMXN, getCurrentQuincena } from '../utils/dates.js';

let _filter = { category: '', status: '', search: '' };

export function renderPlayers(root) {
  root.innerHTML = `
    <section class="flex flex-col gap-5">
      <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p class="section-eyebrow">Plantilla</p>
          <h1 class="font-display font-extrabold text-3xl sm:text-4xl uppercase tracking-tight">Jugadores</h1>
          <p class="muted text-sm mt-1">Gestión de jugadores del club</p>
        </div>
        <button id="btn-new-player" type="button" class="btn btn-primary">
          ${ICON.plus}<span>Nuevo jugador</span>
        </button>
      </header>

      <!-- Resumen + Filtros -->
      <div class="card card-pad">
        <div class="flex flex-wrap items-center gap-2 mb-4" id="players-summary"></div>
        <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div class="sm:col-span-5">
            <label class="label" for="f-search">Buscar</label>
            <input id="f-search" type="search" placeholder="Nombre o teléfono…" class="input" autocomplete="off" />
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="f-category">Categoría</label>
            <select id="f-category" class="select">
              <option value="">Todas</option>
              ${state.categories.map((c) => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="f-status">Estado</label>
            <select id="f-status" class="select">
              <option value="">Todos</option>
              <option value="paid">Al día</option>
              <option value="pending">Pendientes hoy</option>
              <option value="mora">En mora</option>
            </select>
          </div>
          <div class="sm:col-span-1 flex items-end">
            <button id="f-clear" type="button" class="btn btn-ghost w-full">Limpiar</button>
          </div>
        </div>
      </div>

      <!-- Grid -->
      <div id="players-grid"></div>
    </section>
  `;

  const grid    = root.querySelector('#players-grid');
  const summary = root.querySelector('#players-summary');
  const search  = root.querySelector('#f-search');
  const catSel  = root.querySelector('#f-category');
  const staSel  = root.querySelector('#f-status');
  const clear   = root.querySelector('#f-clear');
  const btnNew  = root.querySelector('#btn-new-player');

  search.value = _filter.search;
  catSel.value = _filter.category;
  staSel.value = _filter.status;

  search.addEventListener('input',  (e) => { _filter.search = e.target.value.toLowerCase().trim(); paint(); });
  catSel.addEventListener('change', (e) => { _filter.category = e.target.value; paint(); });
  staSel.addEventListener('change', (e) => { _filter.status   = e.target.value; paint(); });
  clear.addEventListener('click', () => { _filter = { category: '', status: '', search: '' }; search.value = ''; catSel.value = ''; staSel.value = ''; paint(); });
  btnNew.addEventListener('click', () => openPlayerForm(null));

  function paint() {
    const playersWithStatus = state.players.map(playerWithCurrentStatus);
    const filtered = applyFilter(playersWithStatus, _filter);

    // Resumen
    const total     = playersWithStatus.length;
    const paid      = playersWithStatus.filter((p) => p.status === 'paid').length;
    const pending   = playersWithStatus.filter((p) => p.status === 'pending').length;
    const mora      = playersWithStatus.filter((p) => p.status === 'mora').length;
    summary.innerHTML = `
      <span class="tag">${total} totales</span>
      <span class="badge badge-paid">${paid} al día</span>
      ${pending > 0 ? `<span class="badge badge-pending">${pending} pendientes</span>` : ''}
      ${mora > 0 ? `<span class="badge badge-mora">${mora} en mora</span>` : ''}
    `;

    if (filtered.length === 0) {
      grid.innerHTML = state.players.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon mx-auto">${ICON.users}</div>
            <p class="font-display font-extrabold text-xl uppercase">Aún no hay jugadores</p>
            <p class="muted text-sm mt-1">Crea el primero con el botón "Nuevo jugador".</p>
          </div>`
        : `<div class="empty-state">
            <p class="font-display font-bold text-lg uppercase">Sin resultados</p>
            <p class="muted text-sm mt-1">Ajusta los filtros.</p>
          </div>`;
      return;
    }

    grid.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        ${filtered.map(playerCard).join('')}
      </div>
    `;

    grid.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', (e) => { e.stopPropagation(); openPlayerForm(b.dataset.edit); })
    );
    grid.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', (e) => { e.stopPropagation(); onDelete(b.dataset.del); })
    );
    grid.querySelectorAll('[data-msg]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = state.players.find((x) => x.id === b.dataset.msg);
        if (!p) return;
        openMessageMenu(b, p, { amount: amountForPlayer(p) });
      })
    );
  }

  paint();
}

function playerWithCurrentStatus(p) {
  if (p.exempt) return { ...p, status: 'paid', payment: null, diasMora: 0 };
  const cur = getCurrentQuincena();
  const quincena = cur.quincena;
  const payment = state.payments.find((pay) =>
    pay.playerId === p.id &&
    Number(pay.year) === cur.year &&
    Number(pay.quincena) === quincena
  );
  const dias = daysMora(p);
  let status = 'paid';
  if (payment?.status === 'pending') {
    status = dias > 0 ? 'mora' : 'pending';
  } else if (!payment) {
    if (dias > 0) status = 'mora';
    else status = 'pending';
  }
  return { ...p, status, payment: payment || null, diasMora: dias };
}

function applyFilter(list, { category, status, search }) {
  return list
    .filter((p) => !category || p.category === category)
    .filter((p) => !status   || p.status   === status)
    .filter((p) => {
      if (!search) return true;
      const hay = `${p.name} ${p.phone || ''}`.toLowerCase();
      return hay.includes(search);
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function playerCard(p) {
  const cat = findCategoryByName(p.category);
  const amount = formatMXN(amountForPlayer(p));
  const statusBadge = statusBadgeHTML(p);

  return `
    <article class="player-card" data-status="${p.status}">
      <!-- Header -->
      <div class="flex items-start gap-3">
        <div class="player-avatar size-lg" style="${avatarGradient(p.name)}" aria-hidden="true">${escapeHTML(initialsOf(p.name))}</div>
        <div class="min-w-0 flex-1">
          <h3 class="player-name truncate">${escapeHTML(p.name)}</h3>
          <p class="player-meta truncate">${escapeHTML(p.category || 'Sin categoría')}</p>
          <div class="mt-2">${statusBadge}</div>
        </div>
        <div class="flex gap-1">
          <button data-edit="${p.id}" type="button" class="icon-btn" aria-label="Editar a ${escapeHTML(p.name)}">
            ${ICON.edit}
          </button>
          <button data-del="${p.id}" type="button" class="icon-btn icon-btn-danger" aria-label="Eliminar a ${escapeHTML(p.name)}">
            ${ICON.trash}
          </button>
        </div>
      </div>

      <!-- Info -->
      <div class="grid grid-cols-2 gap-2">
        <div class="player-row">
          <div class="min-w-0">
            <p class="text-[10px] uppercase tracking-widest font-bold text-ink-500">Día pago</p>
            ${p.exempt
              ? `<p class="font-display font-extrabold text-lg text-brand-600">Becado</p>`
              : `<p class="font-display font-extrabold text-lg text-ink-900 tabular-nums">${p.paymentDay}</p>`}
          </div>
          <div class="text-right">
            <p class="text-[10px] uppercase tracking-widest font-bold text-ink-500">Mensualidad</p>
            <p class="font-display font-extrabold text-base text-ink-900 tabular-nums">${amount}</p>
          </div>
        </div>
        ${p.phone ? `
          <a href="tel:${escapeHTML(p.phone)}" class="player-row hover:bg-ink-100" style="grid-column: span 2;">
            <span class="inline-flex items-center gap-2 min-w-0">
              <span class="text-ink-500 shrink-0">${ICON.phone}</span>
              <span class="font-mono font-bold text-ink-900 truncate">${escapeHTML(p.phone)}</span>
            </span>
            <span class="text-[10px] uppercase tracking-widest font-bold text-ink-500 shrink-0">Llamar</span>
          </a>` : ''}
      </div>

      ${p.diasMora > 0 ? `
        <div class="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800 font-semibold">
          ${escapeHTML(moraLabel(classifyMora(p)))} · ${p.diasMora} ${p.diasMora === 1 ? 'día' : 'días'} de atraso
        </div>` : ''}

      <!-- Acción principal -->
      <button data-msg="${p.id}" type="button" class="btn-message" ${p.status === 'paid' ? 'data-disabled="true"' : ''}>
        ${ICON.chat}<span>Copiar mensaje de pago</span>
      </button>

      ${p.notes ? `<p class="player-notes">📝 ${escapeHTML(p.notes)}</p>` : ''}
    </article>
  `;
}

function statusBadgeHTML(p) {
  if (p.exempt) return `<span class="badge badge-info">Becado</span>`;
  if (p.status === 'paid')    return `<span class="badge badge-paid">${ICON.check}<span>Al día</span></span>`;
  if (p.status === 'pending') return `<span class="badge badge-pending">${ICON.clock}<span>Pendiente hoy</span></span>`;
  return `<span class="badge badge-mora">${ICON.alert}<span>${escapeHTML(moraLabel(classifyMora(p)))}</span></span>`;
}

function initialsOf(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
}

// === FORMULARIO CREAR/EDITAR ===

function openPlayerForm(id) {
  const editing = id ? state.players.find((p) => p.id === id) : null;
  const cats = state.categories;

  const body = `
    <form id="form-player" class="grid grid-cols-1 sm:grid-cols-2 gap-4" novalidate>
      <div class="sm:col-span-2">
        <label class="label" for="pf-name">Nombre completo *</label>
        <input id="pf-name" name="name" type="text" required autocomplete="off" class="input" value="${editing ? escapeHTML(editing.name) : ''}" />
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="pf-category">Categoría *</label>
        <select id="pf-category" name="category" required class="select">
          <option value="">Selecciona…</option>
          ${cats.map((c) => `<option value="${escapeHTML(c.name)}" ${editing?.category === c.name ? 'selected' : ''}>${escapeHTML(c.name)} — ${formatMXN(c.amount)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="label" for="pf-phone">Teléfono</label>
        <input id="pf-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" class="input" value="${editing ? escapeHTML(editing.phone || '') : ''}" placeholder="55 1234 5678" />
      </div>
      <div>
        <label class="label" for="pf-day">Día de pago *</label>
        <input id="pf-day" name="paymentDay" type="number" min="1" max="31" required class="input tabular" value="${editing?.paymentDay ?? 1}" />
        <p class="form-hint">Cualquier día del mes (1-31).</p>
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="pf-custom">Monto personalizado (MXN)</label>
        <input id="pf-custom" name="customAmount" type="number" min="0" step="50" inputmode="numeric" class="input tabular" value="${editing?.customAmount ?? ''}" placeholder="Opcional" />
        <p class="form-hint">Si se define, reemplaza el monto de la categoría.</p>
      </div>
      <div class="sm:col-span-2">
        <label class="checkbox-row" for="pf-exempt">
          <input id="pf-exempt" type="checkbox" name="exempt" ${editing?.exempt ? 'checked' : ''} />
          <span class="text-sm font-semibold">Jugador becado o exento (no genera pagos)</span>
        </label>
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="pf-notes">Notas</label>
        <textarea id="pf-notes" name="notes" rows="3" class="textarea" placeholder="Información adicional…">${editing ? escapeHTML(editing.notes || '') : ''}</textarea>
      </div>
      <p id="pf-error" class="sm:col-span-2 form-error" hidden></p>
    </form>
  `;

  const footer = `
    <button data-cancel type="button" class="btn btn-secondary">Cancelar</button>
    <button data-save type="button" class="btn btn-primary">${editing ? 'Guardar cambios' : 'Crear jugador'}</button>
  `;

  const m = openModal({ title: editing ? 'Editar jugador' : 'Nuevo jugador', body, footer, size: 'lg' });

  m.panel.querySelector('[data-cancel]').addEventListener('click', m.close);
  m.panel.querySelector('[data-save]').addEventListener('click', async () => {
    const f = m.panel.querySelector('#form-player');
    const errEl = m.panel.querySelector('#pf-error');

    const name = f.name.value.trim();
    const category = f.category.value;
    const day = Number(f.paymentDay.value);
    const customRaw = f.customAmount.value.trim();

    errEl.hidden = true;
    if (!name) { showErr('El nombre es obligatorio'); f.name.focus(); return; }
    if (!category) { showErr('Selecciona una categoría'); f.category.focus(); return; }
    if (!Number.isFinite(day) || day < 1 || day > 31) {
      showErr('El día de pago debe estar entre 1 y 31'); f.paymentDay.focus(); return;
    }
    if (customRaw !== '' && (Number(customRaw) < 0 || !Number.isFinite(Number(customRaw)))) {
      showErr('El monto personalizado no es válido'); f.customAmount.focus(); return;
    }

    const data = {
      name,
      category,
      phone: f.phone.value.trim(),
      notes: f.notes.value.trim(),
      paymentDay: day,
      customAmount: customRaw === '' ? null : Number(customRaw),
      exempt: f.exempt.checked,
    };

    try {
      if (editing) {
        await players.update(editing.id, data);
        toast('Jugador actualizado', 'success');
      } else {
        await players.add(data);
        toast('Jugador creado', 'success');
      }
      m.close();
    } catch (err) {
      console.error(err);
      toast('Error al guardar', 'error');
    }

    function showErr(msg) {
      errEl.textContent = msg;
      errEl.hidden = false;
    }
  });
}

async function onDelete(id) {
  const p = state.players.find((x) => x.id === id);
  if (!p) return;
  const ok = await confirmModal({
    title: 'Eliminar jugador',
    message: `¿Eliminar a "${p.name}"? También se eliminarán sus pagos asociados.`,
    confirmText: 'Sí, eliminar',
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
