import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { type Player, type Category } from '@/types';

const PLAYERS_COLLECTION = 'players';

export const playersService = {
  async getAll(): Promise<Player[]> {
    const q = query(collection(db, PLAYERS_COLLECTION), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Player[];
  },

  async getById(id: string): Promise<Player | null> {
    const docRef = doc(db, PLAYERS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate() || new Date(),
    } as Player;
  },

  async create(player: Omit<Player, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, PLAYERS_COLLECTION), {
      ...player,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async update(id: string, player: Partial<Omit<Player, 'id' | 'createdAt'>>): Promise<void> {
    const docRef = doc(db, PLAYERS_COLLECTION, id);
    await updateDoc(docRef, player);
  },

  async delete(id: string): Promise<void> {
    const docRef = doc(db, PLAYERS_COLLECTION, id);
    await deleteDoc(docRef);
  },

  async getByCategory(category: Category): Promise<Player[]> {
    const q = query(
      collection(db, PLAYERS_COLLECTION),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }))
      .filter((player) => (player as Player).category === category) as Player[];
  },
};
