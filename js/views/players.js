// js/views/players.js
// Vista de Jugadores: grid de tarjetas enriquecidas (avatar, estado, mensaje, acciones).

import { state, toast, openModal, confirmModal, escapeHTML, ICON, avatarGradient, openMessageMenu, findCategoryByName } from '../app.js';
import { players, payments } from '../services/firestore.js';
import { classifyMora, moraLabel } from '../services/mora.js';
import { daysMora, formatMXN, getCurrentQuincena } from '../utils/dates.js';

let _filter = { category: '', status: '', search: '' };

export function renderPlayers(root) {
  root.innerHTML = `
    <section class="flex flex-col gap-6">
      <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 class="font-display font-extrabold text-2xl sm:text-3xl">Jugadores</h1>
          <p class="muted text-sm">Gestión de jugadores del club</p>
        </div>
        <button id="btn-new-player" class="btn-primary">
          ${ICON.plus}
          Nuevo jugador
        </button>
      </header>

      <!-- Filtros -->
      <div class="card card-pad grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div class="sm:col-span-6">
          <label class="label">Buscar</label>
          <input id="f-search" type="search" placeholder="Nombre o teléfono…" class="input" />
        </div>
        <div class="sm:col-span-3">
          <label class="label">Categoría</label>
          <select id="f-category" class="select">
            <option value="">Todas</option>
            ${state.categories.map((c) => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="sm:col-span-3">
          <label class="label">Estado</label>
          <select id="f-status" class="select">
            <option value="">Todos</option>
            <option value="paid">Al día</option>
            <option value="pending">Pendientes</option>
            <option value="mora">En mora</option>
          </select>
        </div>
        <div class="sm:col-span-12 flex justify-end">
          <button id="f-clear" class="btn-ghost btn-sm">Limpiar filtros</button>
        </div>
      </div>

      <!-- Resumen rapido -->
      <div id="players-summary"></div>

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
      <div class="flex flex-wrap gap-2 text-xs">
        <span class="badge badge-neutral">${total} totales</span>
        <span class="badge badge-paid">${paid} al día</span>
        <span class="badge badge-pending">${pending} pendientes</span>
        ${mora > 0 ? `<span class="badge badge-mora">${mora} en mora</span>` : ''}
      </div>
    `;

    if (filtered.length === 0) {
      grid.innerHTML = state.players.length === 0
        ? `<div class="card card-pad text-center"><p class="font-semibold">Aún no hay jugadores</p><p class="muted text-sm">Crea el primero con el botón "Nuevo jugador".</p></div>`
        : `<div class="card card-pad text-center"><p class="font-semibold">Sin resultados</p><p class="muted text-sm">Ajusta los filtros.</p></div>`;
      return;
    }

    grid.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        const cat = findCategoryByName(p.category);
        openMessageMenu(b, p, { amount: cat?.amount || 0 });
      })
    );
  }

  paint();
}

/**
 * Enriquece al jugador con su estado del periodo actual:
 *  status: 'paid' | 'pending' | 'mora'
 *  payment: el Payment del periodo actual (si existe)
 *  diasMora: numero
 */
function playerWithCurrentStatus(p) {
  const cur = getCurrentQuincena();
  const payment = state.payments.find((pay) =>
    pay.playerId === p.id &&
    Number(pay.year) === cur.year &&
    Number(pay.quincena) === cur.quincena
  );
  const dias = daysMora(p);
  let status = 'paid';
  if (payment?.status === 'pending') {
    status = dias > 0 ? 'mora' : 'pending';
  } else if (!payment) {
    // Sin pago del periodo actual: si paso el paymentDay, mora
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
  const amount = formatMXN(cat?.amount ?? 0);
  const statusBadge = statusBadgeHTML(p);

  return `
    <article class="player-rich" data-status="${p.status}">
      <!-- Header: avatar + nombre + acciones -->
      <div class="flex items-start gap-3">
        <div class="avatar-gradient size-lg" style="${avatarGradient(p.name)}">${escapeHTML(initialsOf(p.name))}</div>
        <div class="min-w-0 flex-1">
          <h3 class="font-display font-extrabold text-lg leading-tight truncate">${escapeHTML(p.name)}</h3>
          <p class="text-xs muted truncate">${escapeHTML(p.category || 'Sin categoría')}</p>
        </div>
        <div class="flex flex-col gap-1">
          <button data-edit="${p.id}" class="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900" title="Editar">
            ${ICON.edit}
          </button>
          <button data-del="${p.id}" class="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-500 hover:bg-red-50 hover:text-red-600" title="Eliminar">
            ${ICON.trash}
          </button>
        </div>
      </div>

      <!-- Info: telefono + monto + dia -->
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div class="rounded-xl bg-ink-50/60 px-3 py-2">
          <p class="text-[11px] uppercase tracking-wide muted font-semibold">Teléfono</p>
          ${p.phone
            ? `<a href="tel:${escapeHTML(p.phone)}" class="font-semibold text-ink-900 hover:text-brand-700 inline-flex items-center gap-1.5">${ICON.phone}${escapeHTML(p.phone)}</a>`
            : `<p class="font-semibold text-ink-300">—</p>`}
        </div>
        <div class="rounded-xl bg-ink-50/60 px-3 py-2">
          <p class="text-[11px] uppercase tracking-wide muted font-semibold">Mensualidad</p>
          <p class="font-bold text-ink-900">${amount}</p>
        </div>
      </div>

      <!-- Estado -->
      <div class="flex items-center justify-between gap-2">
        <div>
          <p class="text-[11px] uppercase tracking-wide muted font-semibold mb-1">Estado</p>
          ${statusBadge}
        </div>
        ${p.diasMora > 0 ? `<p class="text-xs muted">Día de pago: <span class="font-semibold text-ink-700">${p.paymentDay}</span></p>` : ''}
      </div>

      <!-- Boton mensaje -->
      <button data-msg="${p.id}" class="btn-message">
        ${ICON.chat}<span>Copiar mensaje de pago</span>
      </button>

      ${p.notes ? `<p class="text-xs text-ink-700 bg-ink-50 rounded-lg p-2 line-clamp-2 border border-ink-100">📝 ${escapeHTML(p.notes)}</p>` : ''}
    </article>
  `;
}

function statusBadgeHTML(p) {
  if (p.status === 'paid') {
    return `<span class="status-pill paid">${ICON.check}<span>Pagado</span></span>`;
  }
  if (p.status === 'pending') {
    return `<span class="status-pill pending">${ICON.clock}<span>Pendiente hoy</span></span>`;
  }
  // mora
  const label = moraLabel(classifyMora(p));
  return `<span class="status-pill mora">${ICON.alert}<span>${escapeHTML(label)}</span></span>`;
}

function initialsOf(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
}

// === FORMULARIO CREAR/EDITAR ===

function openPlayerForm(id) {
  const editing = id ? state.players.find((p) => p.id === id) : null;
  const cats = state.categories;

  const body = `
    <form id="form-player" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="sm:col-span-2">
        <label class="label">Nombre completo *</label>
        <input name="name" required class="input" value="${editing ? escapeHTML(editing.name) : ''}" />
      </div>
      <div>
        <label class="label">Categoría *</label>
        <select name="category" required class="select">
          <option value="">Selecciona…</option>
          ${cats.map((c) => `<option value="${escapeHTML(c.name)}" ${editing?.category === c.name ? 'selected' : ''}>${escapeHTML(c.name)} — ${formatMXN(c.amount)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="label">Teléfono</label>
        <input name="phone" type="tel" class="input" value="${editing ? escapeHTML(editing.phone || '') : ''}" placeholder="55 1234 5678" />
      </div>
      <div>
        <label class="label">Día de pago *</label>
        <select name="paymentDay" required class="select">
          <option value="1"  ${editing?.paymentDay === 1  ? 'selected' : ''}>Día 1 (Q1)</option>
          <option value="15" ${editing?.paymentDay === 15 ? 'selected' : ''}>Día 15 (Q2)</option>
        </select>
      </div>
      <div class="sm:col-span-2">
        <label class="label">Notas</label>
        <textarea name="notes" rows="3" class="textarea" placeholder="Información adicional…">${editing ? escapeHTML(editing.notes || '') : ''}</textarea>
      </div>
    </form>
  `;

  const footer = `
    <button data-cancel class="btn-secondary">Cancelar</button>
    <button data-save class="btn-primary">${editing ? 'Guardar cambios' : 'Crear jugador'}</button>
  `;

  const m = openModal({ title: editing ? 'Editar jugador' : 'Nuevo jugador', body, footer, size: 'lg' });

  m.panel.querySelector('[data-cancel]').addEventListener('click', m.close);
  m.panel.querySelector('[data-save]').addEventListener('click', async () => {
    const f = m.panel.querySelector('#form-player');
    if (!f.reportValidity()) return;

    const data = {
      name: f.name.value.trim(),
      category: f.category.value,
      phone: f.phone.value.trim(),
      notes: f.notes.value.trim(),
      paymentDay: Number(f.paymentDay.value),
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
