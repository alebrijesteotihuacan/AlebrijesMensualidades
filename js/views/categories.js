// js/views/categories.js
// Vista Categorías: CRUD básico para gestionar las categorías del club.

import { state, toast, openModal, confirmModal, escapeHTML, ICON } from '../app.js';
import { categories, players } from '../services/firestore.js';
import { formatMXN } from '../utils/dates.js';

export function renderCategories(root) {
  root.innerHTML = `
    <section class="flex flex-col gap-6">
      <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p class="section-eyebrow">Configuración</p>
          <h1 class="section-title text-2xl sm:text-3xl mt-1">Categorías</h1>
          <p class="text-sm text-zinc-500 mt-1">Gestiona las categorías del club y sus mensualidades.</p>
        </div>
        <button id="btn-new-cat" type="button" class="btn btn-primary">
          ${ICON.plus}<span>Nueva categoría</span>
        </button>
      </header>

      <div id="cat-list" class="card card-pad"></div>
    </section>
  `;

  root.querySelector('#btn-new-cat').addEventListener('click', () => openForm(null));
  paint(root);
}

function paint(root) {
  const list = root.querySelector('#cat-list');
  const cats = state.categories;

  if (cats.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ICON.users}</div>
        <p class="font-semibold">Sin categorías</p>
        <p class="text-sm text-zinc-500 mt-1">Crea la primera con el botón "Nueva categoría".</p>
      </div>
    `;
    return;
  }

  list.innerHTML = `
    <div class="table-wrap overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th class="text-right">Mensualidad</th>
            <th class="text-right hidden sm:table-cell">Jugadores</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${cats.map(row).join('')}
        </tbody>
      </table>
    </div>
  `;

  list.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openForm(b.dataset.edit))
  );
  list.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => onDelete(b.dataset.del))
  );
}

function row(c) {
  const playerCount = state.players.filter((p) => p.category === c.name).length;
  return `
    <tr>
      <td class="font-medium">${escapeHTML(c.name)}</td>
      <td class="text-right tabular-nums font-semibold">${formatMXN(c.amount)}</td>
      <td class="text-right tabular-nums text-zinc-600 hidden sm:table-cell">${playerCount}</td>
      <td class="text-right">
        <div class="inline-flex gap-0.5">
          <button data-edit="${c.id}" type="button" class="icon-btn" aria-label="Editar ${escapeHTML(c.name)}">${ICON.edit}</button>
          <button data-del="${c.id}" type="button" class="icon-btn icon-btn-danger" aria-label="Eliminar ${escapeHTML(c.name)}">${ICON.trash}</button>
        </div>
      </td>
    </tr>
  `;
}

function openForm(id) {
  const editing = id ? state.categories.find((c) => c.id === id) : null;

  const body = `
    <form id="form-cat" class="grid grid-cols-1 gap-3.5" novalidate>
      <div>
        <label class="label" for="ct-name">Nombre *</label>
        <input id="ct-name" name="name" type="text" required autocomplete="off" class="input" value="${editing ? escapeHTML(editing.name) : ''}" placeholder="Ej. Sub-14" />
      </div>
      <div>
        <label class="label" for="ct-amount">Mensualidad (MXN) *</label>
        <input id="ct-amount" name="amount" type="number" min="0" step="50" required inputmode="numeric" class="input tabular" value="${editing ? Number(editing.amount) : ''}" placeholder="750" />
      </div>
      <p id="ct-error" class="form-error" hidden></p>
    </form>
  `;

  const footer = `
    <button data-cancel type="button" class="btn btn-secondary">Cancelar</button>
    <button data-save type="button" class="btn btn-primary">${editing ? 'Guardar' : 'Crear categoría'}</button>
  `;

  const m = openModal({ title: editing ? 'Editar categoría' : 'Nueva categoría', body, footer, size: 'sm' });

  m.panel.querySelector('[data-cancel]').addEventListener('click', m.close);
  m.panel.querySelector('[data-save]').addEventListener('click', async () => {
    const f = m.panel.querySelector('#form-cat');
    const errEl = m.panel.querySelector('#ct-error');
    const name = f.name.value.trim();
    const amount = Number(f.amount.value);

    errEl.hidden = true;
    if (!name) { showErr('El nombre es obligatorio'); f.name.focus(); return; }
    if (!Number.isFinite(amount) || amount < 0) {
      showErr('La mensualidad debe ser un número válido'); f.amount.focus(); return;
    }

    const dup = state.categories.find((c) =>
      c.name.trim().toLowerCase() === name.toLowerCase() && c.id !== editing?.id
    );
    if (dup) { showErr('Ya existe una categoría con ese nombre'); f.name.focus(); return; }

    try {
      if (editing) {
        await categories.update(editing.id, { name, amount });
        toast('Categoría actualizada', 'success');
      } else {
        await categories.add({ name, amount });
        toast('Categoría creada', 'success');
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

async function onDelete(id) {
  const c = state.categories.find((x) => x.id === id);
  if (!c) return;
  const count = state.players.filter((p) => p.category === c.name).length;
  const msg = count > 0
    ? `"${c.name}" tiene ${count} jugador(es) asignado(s). Si la eliminas, esos jugadores quedarán sin categoría. ¿Continuar?`
    : `¿Eliminar la categoría "${c.name}"?`;
  const ok = await confirmModal({
    title: 'Eliminar categoría',
    message: msg,
    confirmText: 'Eliminar',
    danger: true,
  });
  if (!ok) return;
  try {
    await categories.remove(id);
    toast('Categoría eliminada', 'success');
  } catch (e) {
    console.error(e);
    toast('Error al eliminar', 'error');
  }
}
