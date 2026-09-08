// services/firestore.js
// CRUD genérico para las 3 colecciones: players, payments, categories.
// Suscripción en tiempo real (onSnapshot).

import {
  collection,
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
