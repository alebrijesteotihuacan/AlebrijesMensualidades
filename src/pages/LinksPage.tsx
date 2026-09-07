import { usePlayers } from '@/hooks/usePlayers';
import { usePayments } from '@/hooks/usePayments';
import { PaymentLink } from '@/components/payments/PaymentLink';

export function LinksPage() {
  const { players, loading: playersLoading } = usePlayers();
  const { payments, loading: paymentsLoading } = usePayments();

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
        <h1 className="text-3xl font-bold tracking-tight">Links de Pago</h1>
        <p className="text-muted-foreground">
          Mensajes y datos de transferencia para enviar a jugadores
        </p>
      </div>

      <PaymentLink players={players} payments={payments} />
    </div>
  );
}
