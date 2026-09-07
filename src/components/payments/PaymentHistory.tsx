import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Payment } from '@/types';
import { Check, Clock, AlertTriangle, Trash2 } from 'lucide-react';

interface PaymentHistoryProps {
  payments: Payment[];
  onMarkAsPaid: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PaymentHistory({ payments, onMarkAsPaid, onDelete }: PaymentHistoryProps) {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pagado':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'pendiente':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'moroso':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No hay pagos registrados
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Pagos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center space-x-4">
                {getStatusIcon(payment.status)}
                <div>
                  <p className="font-medium">{payment.playerName}</p>
                  <p className="text-sm text-muted-foreground">
                    {payment.category} - {payment.period === '1-15' ? '1-15' : '16-31'}/{payment.month}/{payment.year}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="font-medium">{formatCurrency(payment.amount)}</span>
                {getStatusBadge(payment.status)}
                <div className="flex space-x-2">
                  {payment.status !== 'pagado' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onMarkAsPaid(payment.id)}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Pagar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(payment.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
