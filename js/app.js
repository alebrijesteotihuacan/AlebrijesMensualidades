// js/app.js
// Entry point: router + state + UI helpers (toast, modal, store).

import { players, payments, categories } from './services/firestore.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPlayers }   from './views/players.js';
import { renderPayments }  from './views/payments.js';

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
  document.getElementById('hamburger')?.addEventListener('click', () => {
    document.getElementById('nav-mobile')?.classList.toggle('hidden');
  });

  renderRoute();
});

// ============ TOAST ============ //
const TOAST_ROOT = () => document.getElementById('toast-root');
const ICONS = {
  success: '<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
  error:   '<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
  info:    '<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>',
};

export function toast(message, type = 'info', duration = 3000) {
  const root = TOAST_ROOT();
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${ICONS[type] || ICONS.info}<span>${escapeHTML(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .2s, transform .2s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px)';
    setTimeout(() => el.remove(), 200);
  }, duration);
}

// ============ MODAL ============ //
export function openModal({ title, body, footer, size = 'md' }) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  wrap.innerHTML = `
    <div class="modal-panel ${widths[size] || widths.md}">
      <div class="flex items-center justify-between px-5 py-4 border-b border-ink-100">
        <h3 class="font-display font-bold text-lg">${escapeHTML(title)}</h3>
        <button data-close class="h-8 w-8 rounded-lg hover:bg-ink-100 inline-flex items-center justify-center" aria-label="Cerrar">
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </button>
      </div>
      <div class="p-5">${body}</div>
      ${footer ? `<div class="px-5 py-3 border-t border-ink-100 bg-ink-50/60 rounded-b-2xl flex justify-end gap-2">${footer}</div>` : ''}
    </div>
  `;
  root.appendChild(wrap);

  function close() { root.innerHTML = ''; document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('[data-close]')?.addEventListener('click', close);
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

/** Devuelve el monto actual de la categoría del jugador. */
export function amountForPlayer(player) {
  const cat = findCategoryByName(player?.category);
  return Number(cat?.amount ?? 0);
}
