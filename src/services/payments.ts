import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { type Payment, type PaymentStatus, type PaymentPeriod, type Category, CATEGORY_AMOUNTS } from '@/types';

const PAYMENTS_COLLECTION = 'payments';

export const paymentsService = {
  async getAll(): Promise<Payment[]> {
    const q = query(collection(db, PAYMENTS_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      paidDate: doc.data().paidDate?.toDate() || null,
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Payment[];
  },

  async getById(id: string): Promise<Payment | null> {
    const docRef = doc(db, PAYMENTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return {
      id: docSnap.id,
      ...docSnap.data(),
      paidDate: docSnap.data().paidDate?.toDate() || null,
      createdAt: docSnap.data().createdAt?.toDate() || new Date(),
    } as Payment;
  },

  async getByPlayer(playerId: string): Promise<Payment[]> {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('playerId', '==', playerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      paidDate: doc.data().paidDate?.toDate() || null,
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Payment[];
  },

  async getByMonthYear(month: number, year: number): Promise<Payment[]> {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('month', '==', month),
      where('year', '==', year),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      paidDate: doc.data().paidDate?.toDate() || null,
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Payment[];
  },

  async create(payment: Omit<Payment, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, PAYMENTS_COLLECTION), {
      ...payment,
      paidDate: payment.paidDate ? Timestamp.fromDate(payment.paidDate) : null,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async update(id: string, payment: Partial<Omit<Payment, 'id' | 'createdAt'>>): Promise<void> {
    const docRef = doc(db, PAYMENTS_COLLECTION, id);
    const updateData: Record<string, unknown> = { ...payment };
    if (payment.paidDate !== undefined) {
      updateData.paidDate = payment.paidDate ? Timestamp.fromDate(payment.paidDate) : null;
    }
    await updateDoc(docRef, updateData);
  },

  async delete(id: string): Promise<void> {
    const docRef = doc(db, PAYMENTS_COLLECTION, id);
    await deleteDoc(docRef);
  },

  async markAsPaid(id: string): Promise<void> {
    const docRef = doc(db, PAYMENTS_COLLECTION, id);
    await updateDoc(docRef, {
      status: 'pagado' as PaymentStatus,
      paidDate: Timestamp.now(),
    });
  },

  async generatePaymentsForPeriod(
    players: { id: string; name: string; category: Category }[],
    period: PaymentPeriod,
    month: number,
    year: number
  ): Promise<string[]> {
    const createdIds: string[] = [];
    
    for (const player of players) {
      const existingQuery = query(
        collection(db, PAYMENTS_COLLECTION),
        where('playerId', '==', player.id),
        where('period', '==', period),
        where('month', '==', month),
        where('year', '==', year)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (existingSnapshot.empty) {
        const id = await this.create({
          playerId: player.id,
          playerName: player.name,
          category: player.category,
          period,
          month,
          year,
          amount: CATEGORY_AMOUNTS[player.category],
          status: 'pendiente',
          paidDate: null,
        });
        createdIds.push(id);
      }
    }
    
    return createdIds;
  },
};
