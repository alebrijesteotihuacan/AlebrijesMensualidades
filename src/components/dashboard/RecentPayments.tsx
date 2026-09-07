import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { type Payment } from '@/types';

interface RecentPaymentsProps {
  payments: Payment[];
}

export function RecentPayments({ payments }: RecentPaymentsProps) {
  const recentPayments = payments.slice(0, 10);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pagado':
        return <Badge className="bg-green-100 text-green-800">Pagado</Badge>;
      case 'pendiente':
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
      case 'moroso':
        return <Badge className="bg-red-100 text-red-800">Moroso</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagos Recientes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay pagos registrados
            </p>
          ) : (
            recentPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {payment.playerName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {payment.category} - {payment.period === '1-15' ? '1-15' : '16-31'}/{payment.month}/{payment.year}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">
                    {formatCurrency(payment.amount)}
                  </span>
                  {getStatusBadge(payment.status)}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
