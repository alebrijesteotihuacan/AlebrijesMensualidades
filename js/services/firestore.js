// services/firestore.js
// CRUD genérico para las 3 colecciones: players, payments, categories.
// Suscripción en tiempo real (onSnapshot).

import {
  collection,
  collectionGroup,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  getDoc,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../firebase-config.js';

/** Timestamp server-side helper (al guardar). */
export const stamp = () => ({ createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

/** === Players === */
export const players = {
  all: () => getAll('players'),
  byId: (id) => getDoc(doc(db, 'players', id)),
  add: (data) => addDoc(collection(db, 'players'), { ...data, ...stamp() }),
  update: (id, data) => updateDoc(doc(db, 'players', id), { ...data, updatedAt: serverTimestamp() }),
  remove: (id) => deleteDoc(doc(db, 'players', id)),
  subscribe: (cb) => subscribeCol('players', cb),
};

/** === Notas de jugadores (subcolección players/{id}/notes/{noteId}) === */
export const playerNotes = {
  /** Devuelve todas las notas de un jugador (one-shot). */
  all: (playerId) => getAllSubcol('players', playerId, 'notes'),
  /** Crea una nota para un jugador. `data` debe incluir `text`. */
  add: (playerId, data) => addDoc(
    collection(db, 'players', playerId, 'notes'),
    { ...data, playerId, ...stamp() }
  ),
  /** Actualiza el texto de una nota. */
  update: (playerId, noteId, data) => updateDoc(
    doc(db, 'players', playerId, 'notes', noteId),
    { ...data, updatedAt: serverTimestamp() }
  ),
  /** Elimina una nota. */
  remove: (playerId, noteId) => deleteDoc(doc(db, 'players', playerId, 'notes', noteId)),
  /**
   * Suscripción en tiempo real a las notas de UN jugador.
   * Devuelve el unsubscribe. Ordena en cliente (desc por createdAt).
   */
  subscribe: (playerId, cb) => subscribeSubcol('players', playerId, 'notes', cb),
  /**
   * Suscripción global a TODAS las notas del club via `collectionGroup('notes')`.
   * Devuelve el unsubscribe. Ordena en cliente.
   */
  subscribeAll: (cb) => subscribeCollectionGroup('notes', cb),
};

/** === Payments === */
export const payments = {
  all: () => getAll('payments'),
  byId: (id) => getDoc(doc(db, 'payments', id)),
  add: (data) => addDoc(collection(db, 'payments'), { ...data, ...stamp() }),
  update: (id, data) => updateDoc(doc(db, 'payments', id), { ...data, updatedAt: serverTimestamp() }),
  remove: (id) => deleteDoc(doc(db, 'payments', id)),
  subscribe: (cb) => subscribeCol('payments', cb),
};

/** === Categories === */
export const categories = {
  all: () => getAll('categories'),
  add: (data) => addDoc(collection(db, 'categories'), { ...data, ...stamp() }),
  update: (id, data) => updateDoc(doc(db, 'categories', id), { ...data, updatedAt: serverTimestamp() }),
  upsert: async (id, data) => setDoc(doc(db, 'categories', id), { ...data, updatedAt: serverTimestamp() }, { merge: true }),
  remove: (id) => deleteDoc(doc(db, 'categories', id)),
  subscribe: (cb) => subscribeCol('categories', cb),
};

// === Helpers internos ===

async function getAll(colName) {
  const snap = await getDocs(query(collection(db, colName), orderBy('createdAt', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function subscribeCol(colName, cb) {
  const q = query(collection(db, colName), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error(`[subscribe:${colName}]`, err);
  });
}

/** Lee una subcolección one-shot. */
async function getAllSubcol(parentCol, parentId, subcolName) {
  const snap = await getDocs(
    query(collection(db, parentCol, parentId, subcolName), orderBy('createdAt', 'asc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Suscripción en tiempo real a una subcolección específica. */
function subscribeSubcol(parentCol, parentId, subcolName, cb) {
  const q = query(collection(db, parentCol, parentId, subcolName));
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, playerId: parentId, ...d.data() }));
    docs.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    cb(docs);
  }, (err) => {
    console.error(`[subscribeSubcol:${parentCol}/${parentId}/${subcolName}]`, err);
  });
}

/**
 * Suscripción a todas las subcolecciones con un nombre dado en todo el club.
 * Usa `collectionGroup` y ordena en cliente (no requiere índice compuesto).
 */
function subscribeCollectionGroup(groupName, cb) {
  const q = query(collectionGroup(db, groupName));
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => {
      const data = d.data();
      // Extrae el parentId (playerId) desde la ruta: players/{playerId}/notes/{noteId}
      const parent = d.ref.parent.parent;
      const playerId = parent ? parent.id : (data.playerId || null);
      return { id: d.id, playerId, ...data };
    });
    // Ordena en cliente: más recientes primero
    docs.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    cb(docs);
  }, (err) => {
    console.error(`[subscribeGroup:${groupName}]`, err);
  });
}
