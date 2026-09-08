// tools/seed-categories.js
// Crea las categorías base del club si no existen.
//
// Uso desde la consola del navegador:
//   await import('./tools/seed-categories.js');

import { categories } from '../js/services/firestore.js';
import { toast } from '../js/app.js';

const DEFAULT_CATEGORIES = [
  { name: 'Alebrijes Teotihuacán', amount: 1200 },
  { name: 'Soles Teotihuacán',     amount: 1200 },
  { name: 'Sub-14',                amount: 750 },
  { name: 'Sub-16',                amount: 750 },
  { name: 'Sub-18',                amount: 750 },
];

(async () => {
  try {
    const existing = await categories.all();
    const existingNames = new Set(existing.map((c) => c.name.trim().toLowerCase()));

    const toCreate = DEFAULT_CATEGORIES.filter(
      (c) => !existingNames.has(c.name.trim().toLowerCase())
    );

    if (toCreate.length === 0) {
      toast('Todas las categorías ya existen', 'info', 3000);
      console.log('[seed-categories] Todas las categorías ya existen. Nada que crear.');
      return;
    }

    toast(`Creando ${toCreate.length} categoría(s)…`, 'info', 4000);
    for (const c of toCreate) {
      await categories.add(c);
    }

    console.log('[seed-categories] Creadas:', toCreate.map((c) => c.name));
    toast(`${toCreate.length} categoría(s) creada(s)`, 'success', 4000);
  } catch (err) {
    console.error('[seed-categories] Error:', err);
    toast('Error al crear categorías. Revisa la consola.', 'error');
  }
})();

export { DEFAULT_CATEGORIES };
