// js/app.js
// Entry point: router + state + UI helpers (toast, modal, store).

import { players, payments, categories } from './services/firestore.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPlayers }   from './views/players.js';
import { renderPayments }  from './views/payments.js';
import { renderStats }     from './views/stats.js';
import { renderCategories } from './views/categories.js';

// ============ STATE GLOBAL ============ //
export const state = {
  players: [],
  payments: [],
  categories: [],
  ready: false,
};

// Suscripciones en tiempo real
players.subscribe((data)   => { state.players = data;   onChange(); });
payments.subscribe((data)  => { state.payments = data;  onChange(); });
categories.subscribe((data)=> { state.categories = data; onChange(); });

let renderToken = 0;
function onChange() {
  state.ready = true;
  clearTimeout(renderToken);
  renderToken = setTimeout(renderRoute, 16);
}

// ============ ROUTER ============ //
const ROUTES = {
  '':         renderDashboard,
  dashboard:  renderDashboard,
  players:    renderPlayers,
  payments:   renderPayments,
  stats:      renderStats,
  categories: renderCategories,
};

function getRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const key = hash.split('/')[0] || 'dashboard';
  return ROUTES[key] ? key : 'dashboard';
}

function renderRoute() {
  const main = document.getElementById('main');
  if (!main) return;

  const route = getRoute();
  const view  = ROUTES[route] || renderDashboard;
  main.innerHTML = '';

  if (!state.ready) {
    main.innerHTML = `
      <div class="flex items-center justify-center min-h-[60vh]">
        <div class="text-center">
          <div class="inline-block h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"></div>
          <p class="mt-4 text-ink-500">Cargando datos…</p>
        </div>
      </div>`;
    return;
  }

  view(main);
  highlightNav(route);
  // Cerrar menú móvil al navegar
  document.getElementById('nav-mobile')?.classList.add('hidden');
}

function highlightNav(route) {
  document.querySelectorAll('[data-route]').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.route === route);
  });
}

window.addEventListener('hashchange', renderRoute);

// ============ INIT ============ //
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();

  // Si no hay hash, redirigir al dashboard
  if (!window.location.hash) window.location.hash = '#/dashboard';

  // Hamburguesa
  const btn = document.getElementById('hamburger');
  const menu = document.getElementById('nav-mobile');
  if (btn && menu) {
    btn.addEventListener('click', () => {
      const isOpen = !menu.hidden;
      menu.hidden = isOpen;
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  }

  renderRoute();
});

// ============ TOAST ============ //
const TOAST_ROOT = () => document.getElementById('toast-root');
const ICONS = {
  success: '<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
  error:   '<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
  info:    '<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>',
};

export function toast(message, type = 'info', duration = 3500) {
  const root = TOAST_ROOT();
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast is-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `${ICONS[type] || ICONS.info}<span>${escapeHTML(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .15s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 150);
  }, duration);
}

// ============ MODAL ============ //
export function openModal({ title, body, footer, size = 'md' }) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = '';
  const previouslyFocused = document.activeElement;
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', title);
  const sizeClass = size === 'lg' ? 'size-lg' : size === 'xl' ? 'size-xl' : size === 'sm' ? 'size-sm' : '';
  wrap.innerHTML = `
    <div class="modal-panel ${sizeClass}">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHTML(title)}</h3>
        <button data-close type="button" class="icon-btn" aria-label="Cerrar">
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>
  `;
  root.appendChild(wrap);

  function close() {
    root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const focusables = wrap.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('[data-close]')?.addEventListener('click', close);

  // Focus first focusable element
  setTimeout(() => {
    const firstInput = wrap.querySelector('input:not([type=hidden]), select, textarea, button');
    firstInput?.focus();
  }, 50);

  return { close, panel: wrap.querySelector('.modal-panel') };
}

export function confirmModal({ title = '¿Confirmar?', message = '', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    const m = openModal({
      title,
      body: `<p class="text-sm text-ink-700">${escapeHTML(message)}</p>`,
      footer: `
        <button data-cancel class="btn-secondary">${escapeHTML(cancelText)}</button>
        <button data-ok class="${danger ? 'btn-danger' : 'btn-primary'}">${escapeHTML(confirmText)}</button>
      `,
    });
    m.panel.querySelector('[data-cancel]').addEventListener('click', () => { m.close(); resolve(false); });
    m.panel.querySelector('[data-ok]').addEventListener('click', () => { m.close(); resolve(true); });
  });
}

// ============ HELPERS ============ //
export function escapeHTML(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function initials(name = '') {
  return String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
}

export function findCategoryByName(name) {
  return state.categories.find((c) => c.name === name) || null;
}

/** Devuelve el monto del jugador: prioriza customAmount, luego la categoría. */
export function amountForPlayer(player) {
  if (player?.customAmount != null && player.customAmount !== '') {
    const n = Number(player.customAmount);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const cat = findCategoryByName(player?.category);
  return Number(cat?.amount ?? 0);
}

// ============ ICONOS SVG ============ //
export const ICON = {
  plus: '<svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/></svg>',
  edit: '<svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>',
  trash: '<svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
  copy: '<svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4"><path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z"/><path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 sm:h-6 sm:w-6"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 sm:h-6 sm:w-6"><path d="M20 6L9 17l-5-5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 sm:h-6 sm:w-6"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 sm:h-6 sm:w-6"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 sm:h-6 sm:w-6"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 sm:h-6 sm:w-6"><path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v4"/><path d="M12 14v4"/><path d="M16 14v4"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  chevronDown: '<svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>',
};

// ============ DROPDOWN DE MENSAJES ============ //
// Catalogo con su icono y tono (reusado por tarjeta y tabla).
export const MSG_LEVELS = [
  { key: 'recordatorio', label: 'Recordatorio', sub: 'Sin atraso - dia limite', tone: 'sky',     icon: 'check' },
  { key: 'mora1',        label: 'Mora 1 dia',    sub: 'Atraso de 1-2 dias',     tone: 'amber',   icon: 'clock' },
  { key: 'mora3',        label: 'Mora 3 dias',   sub: 'Atraso de 3-4 dias',     tone: 'orange',  icon: 'alert' },
  { key: 'mora5',        label: 'No podra entrenar', sub: 'Atraso de 5+ dias',  tone: 'red',     icon: 'ban' },
];

const TONE_CLASS = {
  sky:    { bg: 'bg-[#D5E0EC]', text: 'text-[#142A47]' },
  amber:  { bg: 'bg-[#FFE2C7]', text: 'text-[#7A2D07]' },
  orange: { bg: 'bg-[#FFE2C7]', text: 'text-[#A73F0A]' },
  red:    { bg: 'bg-[#FEE2E2]', text: 'text-[#991B1B]' },
};

const BAN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>';

/**
 * Abre un menu flotante con las 4 opciones de mensaje para el jugador.
 * @param {HTMLElement} anchor  boton que dispara el menu
 * @param {{id:string, name:string, paymentDay:1|15, category?:string, phone?:string}} player
 * @param {{amount?:number}} [payment]   para los placeholders {monto}
 */
export function openMessageMenu(anchor, player, payment = {}) {
  closeMessageMenu();
  // Importacion dinamica para no romper en entornos sin bundler
  import('./services/messages.js').then(({ renderMessage, copyToClipboard }) => {
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'msg-menu';
    menu.id = 'msg-menu';
    const itemHTML = MSG_LEVELS.map((m) => {
      const tone = TONE_CLASS[m.tone] || TONE_CLASS.sky;
      const ic = m.icon === 'ban' ? BAN_ICON : (ICON[m.icon] || ICON.chat);
      return `
        <button type="button" class="msg-menu-item" data-level="${m.key}">
          <span class="msg-icon ${tone.bg} ${tone.text}">${ic}</span>
          <span class="min-w-0">
            <span class="msg-title">${m.label}</span>
            <span class="msg-sub block">${m.sub}</span>
          </span>
        </button>
      `;
    }).join('');

    menu.innerHTML = itemHTML;
    document.body.appendChild(menu);

    // Posicionamiento: preferido derecha, sino izquierda, sino abajo
    const mw = 320, mh = menu.offsetHeight || 280;
    let left = rect.right - mw;
    if (left < 8) left = 8;
    let top = rect.bottom + 8;
    if (top + mh > window.innerHeight - 8) {
      top = rect.top - mh - 8;
    }
    if (top < 8) top = 8;
    menu.style.left = `${left}px`;
    menu.style.top  = `${top}px`;

    const backdrop = document.createElement('div');
    backdrop.className = 'msg-backdrop';
    backdrop.id = 'msg-backdrop';
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', closeMessageMenu);
    document.addEventListener('keydown', escClose);

    menu.querySelectorAll('[data-level]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const level = btn.dataset.level;
        const fakePayment = {
          year: new Date().getFullYear(),
          quincena: new Date().getDate() <= 15 ? 1 : 2,
          amount: payment.amount ?? amountForPlayer(player),
        };
        const today = new Date();
        // Si el nivel real coincide con el forzado, lo usamos tal cual.
        // Si no, ajustamos paymentDay en una copia del jugador para forzar el nivel deseado.
        let effectivePlayer = player;
        const real = renderMessage(player, fakePayment, today);
        if (real.level !== level) {
          const offset = level === 'mora1' ? 1 : level === 'mora3' ? 3 : level === 'mora5' ? 5 : 0;
          effectivePlayer = { ...player, paymentDay: player.paymentDay - offset };
        }
        const { text } = renderMessage(effectivePlayer, fakePayment, today);
        try {
          await copyToClipboard(text);
          toast(`Mensaje copiado (${btn.querySelector('.msg-title').textContent})`, 'success', 2500);
        } catch (e) {
          console.error(e);
          toast('No se pudo copiar', 'error');
        }
        closeMessageMenu();
      });
    });
  });
}

export function closeMessageMenu() {
  document.getElementById('msg-menu')?.remove();
  document.getElementById('msg-backdrop')?.remove();
  document.removeEventListener('keydown', escClose);
}
function escClose(e) { if (e.key === 'Escape') closeMessageMenu(); }

// Color sólido determinístico por nombre para avatares.
// Paleta acotada y neutra — sin gradientes.
export function avatarGradient(name = '') {
  const palette = [
    '#52525B', // zinc-600
    '#3F3F46', // zinc-700
    '#27272A', // zinc-800
    '#71717A', // zinc-500
    '#09090B', // zinc-950
    '#A1A1AA', // zinc-400
    '#1E293B', // slate-800
    '#334155', // slate-700
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `--avatar-color:${palette[h % palette.length]};`;
}
