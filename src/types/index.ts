export type Category =
  | 'Alebrijes Teotihuacan'
  | 'Soles Teotihuacan'
  | 'Sub-18'
  | 'Sub-16'
  | 'Sub-14';

export type PaymentStatus = 'pagado' | 'pendiente' | 'moroso';

export type PaymentPeriod = '1-15' | '16-31';

export interface Player {
  id: string;
  name: string;
  category: Category;
  phone: string;
  notes: string;
  createdAt: Date;
}

export interface Payment {
  id: string;
  playerId: string;
  playerName: string;
  category: Category;
  period: PaymentPeriod;
  month: number;
  year: number;
  amount: number;
  status: PaymentStatus;
  paidDate: Date | null;
  createdAt: Date;
}

export interface KPIs {
  totalPlayers: number;
  tdpPlayers: number;
  sub18Players: number;
  sub16Players: number;
  sub14Players: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  cut15Paid: number;
  cut15Pending: number;
  cut30Paid: number;
  cut30Pending: number;
  totalPending: number;
  totalCollected: number;
}

export const CATEGORIES: Category[] = [
  'Alebrijes Teotihuacan',
  'Soles Teotihuacan',
  'Sub-18',
  'Sub-16',
  'Sub-14',
];

export const CATEGORY_AMOUNTS: Record<Category, number> = {
  'Alebrijes Teotihuacan': 1200,
  'Soles Teotihuacan': 1200,
  'Sub-18': 750,
  'Sub-16': 750,
  'Sub-14': 750,
};

export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
