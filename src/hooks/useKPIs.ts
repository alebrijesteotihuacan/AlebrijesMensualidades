import { useMemo } from 'react';
import { type Player, type Payment, type KPIs } from '@/types';

export function useKPIs(players: Player[], payments: Payment[]): KPIs {
  return useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();
    const currentPeriod = currentDay <= 15 ? '1-15' : '16-31';

    const currentPayments = payments.filter(
      (p) => p.month === currentMonth && p.year === currentYear
    );

    const periodPayments = currentPayments.filter(
      (p) => p.period === currentPeriod
    );

    const paidCount = periodPayments.filter((p) => p.status === 'pagado').length;
    const pendingCount = periodPayments.filter((p) => p.status === 'pendiente').length;
    const overdueCount = currentPayments.filter((p) => p.status === 'moroso').length;

    const cut15Payments = currentPayments.filter((p) => p.period === '1-15');
    const cut15Paid = cut15Payments.filter((p) => p.status === 'pagado').length;
    const cut15Pending = cut15Payments.filter((p) => p.status !== 'pagado').length;

    const cut30Payments = currentPayments.filter((p) => p.period === '16-31');
    const cut30Paid = cut30Payments.filter((p) => p.status === 'pagado').length;
    const cut30Pending = cut30Payments.filter((p) => p.status !== 'pagado').length;

    const totalPending = currentPayments
      .filter((p) => p.status !== 'pagado')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalCollected = currentPayments
      .filter((p) => p.status === 'pagado')
      .reduce((sum, p) => sum + p.amount, 0);

    const tdpPlayers = players.filter(
      (p) => p.category === 'Alebrijes Teotihuacan' || p.category === 'Soles Teotihuacan'
    ).length;

    const sub18Players = players.filter((p) => p.category === 'Sub-18').length;
    const sub16Players = players.filter((p) => p.category === 'Sub-16').length;
    const sub14Players = players.filter((p) => p.category === 'Sub-14').length;

    return {
      totalPlayers: players.length,
      tdpPlayers,
      sub18Players,
      sub16Players,
      sub14Players,
      paidCount,
      pendingCount,
      overdueCount,
      cut15Paid,
      cut15Pending,
      cut30Paid,
      cut30Pending,
      totalPending,
      totalCollected,
    };
  }, [players, payments]);
}
