// tools/seed.js
// Script de seed para poblar Firestore con categorías, jugadores y pagos de ejemplo.
// USO:
//   1) Servir el sitio localmente (cualquier static server).
//   2) Abrir la consola del navegador en la página principal.
//   3) Pegar y ejecutar:
//        import('./js/tools/seed.js').then(m => m.seedDemo())
//
// IMPORTANTE: Este archivo se carga como módulo desde la propia app.
// Solo crea datos si las colecciones están vacías (idempotente).

import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  setDoc,
  doc,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../firebase-config.js';

const CATEGORIES = [
  { id: 'alebrijes-tdp', name: 'Alebrijes Teotihuacan (TDP)', amount: 1200 },
  { id: 'soles-tdp',     name: 'Soles Teotihuacan (TDP)',     amount: 1200 },
  { id: 'sub-18',        name: 'Sub-18',                      amount: 750  },
  { id: 'sub-16',        name: 'Sub-16',                      amount: 750  },
  { id: 'sub-14',        name: 'Sub-14',                      amount: 750  },
];

const PLAYERS = [
  { name: 'Carlos Méndez',       category: 'Alebrijes Teotihuacan (TDP)', phone: '55 1234 5678', paymentDay: 1,  notes: 'Defensa central' },
  { name: 'Luis Hernández',      category: 'Alebrijes Teotihuacan (TDP)', phone: '55 2345 6789', paymentDay: 15, notes: '' },
  { name: 'Diego Ramírez',       category: 'Soles Teotihuacan (TDP)',     phone: '55 3456 7890', paymentDay: 1,  notes: 'Portero titular' },
  { name: 'Andrés Torres',       category: 'Soles Teotihuacan (TDP)',     phone: '55 4567 8901', paymentDay: 15, notes: '' },
  { name: 'Mateo García',        category: 'Sub-18',                      phone: '55 5678 9012', paymentDay: 1,  notes: 'Capitán Sub-18' },
  { name: 'Santiago López',      category: 'Sub-18',                      phone: '55 6789 0123', paymentDay: 15, notes: '' },
  { name: 'Emiliano Pérez',      category: 'Sub-16',                      phone: '55 7890 1234', paymentDay: 1,  notes: '' },
  { name: 'Daniel Flores',       category: 'Sub-16',                      phone: '55 8901 2345', paymentDay: 15, notes: 'Lesión rodilla' },
  { name: 'Bruno Castillo',      category: 'Sub-14',                      phone: '55 9012 3456', paymentDay: 1,  notes: '' },
  { name: 'Iker Vargas',         category: 'Sub-14',                      phone: '55 0123 4567', paymentDay: 15, notes: '' },
];

async function existsAny(colName) {
  const snap = await getDocs(collection(db, colName));
  return !snap.empty;
}

async function ensureCategories() {
  if (await existsAny('categories')) {
    console.log('[seed] categories ya tienen datos. Skip.');
    return;
  }
  for (const c of CATEGORIES) {
    await setDoc(doc(db, 'categories', c.id), {
      name: c.name,
      amount: c.amount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  console.log(`[seed] ${CATEGORIES.length} categorías creadas.`);
}

async function ensurePlayers() {
  if (await existsAny('players')) {
    console.log('[seed] players ya tienen datos. Skip.');
    return [];
  }
  const created = [];
  for (const p of PLAYERS) {
    const ref = await addDoc(collection(db, 'players'), {
      ...p,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    created.push({ id: ref.id, ...p });
  }
  console.log(`[seed] ${created.length} jugadores creados.`);
  return created;
}

async function ensurePayments(playersList) {
  if (await existsAny('payments')) {
    console.log('[seed] payments ya tienen datos. Skip.');
    return;
  }
  if (!playersList.length) return;

  const today = new Date();
  const year = today.getFullYear();
  // Genera pagos del año en curso, Q1 (pagado) + Q2 (algunos pendientes).
  const cats = await getDocs(collection(db, 'categories'));
  const catByName = new Map(cats.docs.map((d) => [d.data().name, d.data().amount]));

  let created = 0;
  for (const p of playersList) {
    const amount = catByName.get(p.category) ?? 0;

    // Q1 pagada
    await addDoc(collection(db, 'payments'), {
      playerId: p.id,
      year,
      quincena: 1,
      amount,
      status: 'paid',
      paidDate: `${year}-01-${String(p.paymentDay).padStart(2, '0')}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    created++;

    // Q2: mitad pendiente, mitad pagada
    const isPending = created % 2 === 0;
    await addDoc(collection(db, 'payments'), {
      playerId: p.id,
      year,
      quincena: 2,
      amount,
      status: isPending ? 'pending' : 'paid',
      paidDate: isPending ? null : `${year}-02-${String(p.paymentDay).padStart(2, '0')}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    created++;
  }
  console.log(`[seed] ${created} pagos de ejemplo creados.`);
}

export async function seedDemo() {
  console.log('[seed] Iniciando…');
  await ensureCategories();
  const pl = await ensurePlayers();
  await ensurePayments(pl);
  console.log('[seed] ✅ Listo. Recarga la página para ver los datos.');
}

export async function resetAll() {
  // ⚠️ PELIGRO: esto BORRA todas las colecciones (solo si lo ejecutas a mano).
  const { deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
  for (const colName of ['players', 'payments', 'categories']) {
    const snap = await getDocs(collection(db, colName));
    for (const d of snap.docs) await deleteDoc(doc(db, colName, d.id));
  }
  console.log('[seed] 🗑️ Todas las colecciones vaciadas.');
}

// Expone en window para usar desde la consola sin import dinámico.
window.seedDemo = seedDemo;
window.resetAll = resetAll;
