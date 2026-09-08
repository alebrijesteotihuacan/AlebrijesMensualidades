// js/views/players.js
// Vista Jugadores: cards minimalistas, planas, monocromas.

import { state, toast, openModal, confirmModal, escapeHTML, ICON, avatarGradient, openMessageMenu, amountForPlayer, findCategoryByName, toWhatsAppUrl } from '../app.js';
import { players, payments } from '../services/firestore.js';
import { classifyMora, moraLabel } from '../services/mora.js';
import { daysMora, formatMXN, getCurrentQuincena } from '../utils/dates.js';

let _filter = { category: '', status: '', search: '' };

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
      <div class="card card-pad flex flex-col gap-3">
        <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div class="sm:col-span-6">
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
          <div class="sm:col-span-2">
            <label class="label" for="f-status">Estado</label>
            <select id="f-status" class="select">
              <option value="">Todos</option>
              <option value="paid">Al día</option>
              <option value="pending">Pendientes</option>
              <option value="mora">En mora</option>
            </select>
          </div>
          <div class="sm:col-span-1 flex items-end">
            <button id="f-clear" type="button" class="btn btn-ghost w-full">Limpiar</button>
          </div>
        </div>
      </div>

      <!-- Summary chips -->
      <div class="flex flex-wrap items-center gap-1.5" id="players-summary"></div>

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

    const total   = playersWithStatus.length;
    const paid    = playersWithStatus.filter((p) => p.status === 'paid').length;
    const pending = playersWithStatus.filter((p) => p.status === 'pending').length;
    const mora    = playersWithStatus.filter((p) => p.status === 'mora').length;
    summary.innerHTML = `
      <span class="status"><span class="status-dot dot-neutral"></span><span>${total} totales</span></span>
      <span class="status"><span class="status-dot dot-success"></span><span>${paid} al día</span></span>
      ${pending > 0 ? `<span class="status"><span class="status-dot dot-warning"></span><span>${pending} pendientes</span></span>` : ''}
      ${mora > 0 ? `<span class="status"><span class="status-dot dot-danger"></span><span>${mora} en mora</span></span>` : ''}
    `;

    if (filtered.length === 0) {
      grid.innerHTML = state.players.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon">${ICON.users}</div>
            <p class="font-semibold">Aún no hay jugadores</p>
            <p class="text-sm text-zinc-500 mt-1">Crea el primero con el botón "Nuevo jugador".</p>
          </div>`
        : `<div class="empty-state">
            <p class="font-semibold">Sin resultados</p>
            <p class="text-sm text-zinc-500 mt-1">Ajusta los filtros.</p>
          </div>`;
      return;
    }

    grid.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
  const amount = formatMXN(amountForPlayer(p));
  return `
    <article class="player-card" data-status="${p.status}">
      <!-- Header -->
      <div class="flex items-start gap-3">
        <div class="avatar size-lg" style="${avatarGradient(p.name)}" aria-hidden="true">${escapeHTML(initialsOf(p.name))}</div>
        <div class="min-w-0 flex-1">
          <h3 class="player-name truncate">${escapeHTML(p.name)}</h3>
          <p class="player-meta truncate">${escapeHTML(p.category || 'Sin categoría')}</p>
          <div class="mt-1.5">${statusInline(p)}</div>
        </div>
        <div class="flex gap-0.5">
          <button data-edit="${p.id}" type="button" class="icon-btn" aria-label="Editar a ${escapeHTML(p.name)}">${ICON.edit}</button>
          <button data-del="${p.id}" type="button" class="icon-btn icon-btn-danger" aria-label="Eliminar a ${escapeHTML(p.name)}">${ICON.trash}</button>
        </div>
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

      ${p.phone ? `
        <a href="${toWhatsAppUrl(p.phone)}" target="_blank" rel="noopener noreferrer" aria-label="Enviar mensaje de WhatsApp a ${escapeHTML(p.name)}" class="flex items-center justify-between border-t border-zinc-100 pt-3 hover:text-zinc-950">
          <span class="player-phone">${ICON.whatsapp}<span>${escapeHTML(p.phone)}</span></span>
          <span class="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Mensaje</span>
        </a>` : ''}

      <!-- Action -->
      <button data-msg="${p.id}" type="button" class="btn btn-secondary w-full justify-center" ${p.status === 'paid' && !p.exempt ? 'disabled' : ''}>
        ${ICON.chat}<span>Copiar mensaje de pago</span>
      </button>

      ${p.notes ? `<p class="text-xs text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-md px-2.5 py-2 leading-relaxed">${escapeHTML(p.notes)}</p>` : ''}
    </article>
  `;
}

function statusInline(p) {
  if (p.exempt) return `<span class="status"><span class="status-dot dot-neutral"></span><span>Becado</span></span>`;
  if (p.status === 'paid')    return `<span class="status"><span class="status-dot dot-success"></span><span>Al día</span></span>`;
  if (p.status === 'pending') return `<span class="status"><span class="status-dot dot-warning"></span><span>Pendiente hoy</span></span>`;
  const dias = p.diasMora;
  const dot = dias >= 5 ? 'dot-danger' : 'dot-warning';
  return `<span class="status"><span class="status-dot ${dot}"></span><span>${escapeHTML(moraLabel(classifyMora(p)))} · ${dias}d</span></span>`;
}

function initialsOf(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
}

// === FORMULARIO CREAR/EDITAR ===

function openPlayerForm(id) {
  const editing = id ? state.players.find((p) => p.id === id) : null;
  const cats = state.categories;

  const body = `
    <form id="form-player" class="grid grid-cols-1 sm:grid-cols-2 gap-3.5" novalidate>
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
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="pf-custom">Monto personalizado (MXN)</label>
        <input id="pf-custom" name="customAmount" type="number" min="0" step="50" inputmode="numeric" class="input tabular" value="${editing?.customAmount ?? ''}" placeholder="Opcional — reemplaza el monto de la categoría" />
      </div>
      <div class="sm:col-span-2">
        <label class="checkbox-row" for="pf-exempt">
          <input id="pf-exempt" type="checkbox" name="exempt" ${editing?.exempt ? 'checked' : ''} />
          <span class="text-sm font-medium">Jugador becado o exento</span>
        </label>
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="pf-notes">Notas</label>
        <textarea id="pf-notes" name="notes" rows="2" class="textarea" placeholder="Información adicional…">${editing ? escapeHTML(editing.notes || '') : ''}</textarea>
      </div>
      <p id="pf-error" class="sm:col-span-2 form-error" hidden></p>
    </form>
  `;

  const footer = `
    <button data-cancel type="button" class="btn btn-secondary">Cancelar</button>
    <button data-save type="button" class="btn btn-primary">${editing ? 'Guardar' : 'Crear jugador'}</button>
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
