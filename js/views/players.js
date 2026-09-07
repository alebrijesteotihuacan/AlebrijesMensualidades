// js/views/players.js
// Vista de Jugadores: grid responsivo con CRUD + filtros.

import { state, toast, openModal, confirmModal, escapeHTML, initials, findCategoryByName } from '../app.js';
import { players, payments } from '../services/firestore.js';
import { classifyMora, moraBadgeClass, moraLabel } from '../services/mora.js';
import { formatMXN } from '../utils/dates.js';

let _filter = { category: '', search: '' };

export function renderPlayers(root) {
  root.innerHTML = `
    <section class="flex flex-col gap-6">
      <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 class="font-display font-extrabold text-2xl sm:text-3xl">Jugadores</h1>
          <p class="muted text-sm">Gestión de jugadores del club</p>
        </div>
        <button id="btn-new-player" class="btn-primary">
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/></svg>
          Nuevo jugador
        </button>
      </header>

      <!-- Filtros -->
      <div class="card card-pad flex flex-col sm:flex-row gap-3">
        <div class="flex-1">
          <label class="label">Buscar</label>
          <input id="f-search" type="search" placeholder="Nombre o teléfono…" class="input" />
        </div>
        <div class="sm:w-64">
          <label class="label">Categoría</label>
          <select id="f-category" class="select">
            <option value="">Todas</option>
            ${state.categories.map((c) => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="self-end">
          <button id="f-clear" class="btn-ghost">Limpiar</button>
        </div>
      </div>

      <!-- Grid -->
      <div id="players-grid"></div>
    </section>
  `;

  const grid    = root.querySelector('#players-grid');
  const search  = root.querySelector('#f-search');
  const catSel  = root.querySelector('#f-category');
  const clear   = root.querySelector('#f-clear');
  const btnNew  = root.querySelector('#btn-new-player');

  search.value = _filter.search;
  catSel.value = _filter.category;

  search.addEventListener('input', (e) => { _filter.search = e.target.value.toLowerCase().trim(); paint(); });
  catSel.addEventListener('change', (e) => { _filter.category = e.target.value; paint(); });
  clear.addEventListener('click', () => { _filter = { category: '', search: '' }; search.value = ''; catSel.value = ''; paint(); });
  btnNew.addEventListener('click', () => openPlayerForm(null));

  function paint() {
    const filtered = applyFilter(state.players, _filter);
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
      b.addEventListener('click', () => openPlayerForm(b.dataset.edit))
    );
    grid.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => onDelete(b.dataset.del))
    );
  }

  paint();
}

function applyFilter(list, { category, search }) {
  return list
    .filter((p) => !category || p.category === category)
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
  const level = classifyMora(p);
  const badge = `<span class="${moraBadgeClass(level)}">${moraLabel(level)}</span>`;

  return `
    <article class="player-card">
      <div class="flex items-start gap-3">
        <div class="player-avatar">${escapeHTML(initials(p.name) || '?')}</div>
        <div class="flex-1 min-w-0">
          <h3 class="font-display font-bold text-base truncate">${escapeHTML(p.name)}</h3>
          <p class="text-xs muted">${escapeHTML(p.category || '—')}</p>
          <p class="text-xs muted">📞 ${escapeHTML(p.phone || '—')}</p>
        </div>
        ${badge}
      </div>

      ${p.notes ? `<p class="text-xs text-ink-700 bg-ink-50 rounded-lg p-2 line-clamp-2">${escapeHTML(p.notes)}</p>` : ''}

      <div class="flex items-center justify-between text-xs">
        <div>
          <p class="muted">Mensualidad</p>
          <p class="font-bold">${amount}</p>
        </div>
        <div>
          <p class="muted">Día de pago</p>
          <p class="font-bold">Día ${p.paymentDay}</p>
        </div>
      </div>

      <div class="flex gap-2 pt-2 border-t border-ink-100">
        <button data-edit="${p.id}" class="btn-secondary flex-1">
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
          Editar
        </button>
        <button data-del="${p.id}" class="btn-ghost text-red-600 hover:bg-red-50" aria-label="Eliminar">
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        </button>
      </div>
    </article>
  `;
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
    // eliminar pagos del jugador
    const related = state.payments.filter((pay) => pay.playerId === id);
    await Promise.all(related.map((pay) => payments.remove(pay.id)));
    await players.remove(id);
    toast('Jugador eliminado', 'success');
  } catch (err) {
    console.error(err);
    toast('Error al eliminar', 'error');
  }
}
