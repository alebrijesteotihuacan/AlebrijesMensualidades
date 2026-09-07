import { usePlayers } from '@/hooks/usePlayers';
import { usePayments } from '@/hooks/usePayments';
import { useKPIs } from '@/hooks/useKPIs';
import { KPICards } from '@/components/dashboard/KPICards';
import { RecentPayments } from '@/components/dashboard/RecentPayments';
import { MONTHS } from '@/types';

export function DashboardPage() {
  const { players, loading: playersLoading } = usePlayers();
  const { payments, loading: paymentsLoading } = usePayments();
  const kpis = useKPIs(players, payments);

  const now = new Date();
  const currentMonth = MONTHS[now.getMonth()];
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  const currentPeriod = currentDay <= 15 ? '1-15' : '16-31';

  if (playersLoading || paymentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {currentMonth} {currentYear} - Periodo actual: {currentPeriod}
        </p>
      </div>

      <KPICards kpis={kpis} />

      <div className="grid gap-6 md:grid-cols-1">
        <RecentPayments payments={payments} />
      </div>
    </div>
  );
}
