import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type Player, type Payment, CATEGORY_AMOUNTS } from '@/types';
import { Copy, Check, Phone, MessageCircle } from 'lucide-react';
import { useState } from 'react';

interface PaymentLinkProps {
  players: Player[];
  payments: Payment[];
}

export function PaymentLink({ players, payments }: PaymentLinkProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getCurrentPeriod = () => {
    const now = new Date();
    const day = now.getDate();
    return day <= 15 ? '1-15' : '16-31';
  };

  const getCurrentMonth = () => new Date().getMonth() + 1;
  const getCurrentYear = () => new Date().getFullYear();

  const getPendingPlayers = () => {
    const period = getCurrentPeriod();
    const month = getCurrentMonth();
    const year = getCurrentYear();

    return players.filter((player) => {
      const payment = payments.find(
        (p) =>
          p.playerId === player.id &&
          p.period === period &&
          p.month === month &&
          p.year === year
      );
      return !payment || payment.status !== 'pagado';
    });
  };

  const generateMessage = (player: Player) => {
    const amount = CATEGORY_AMOUNTS[player.category];
    const period = getCurrentPeriod();
    const month = getCurrentMonth();
    const year = getCurrentYear();
    const formatted = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);

    return `Hola ${player.name}, te recuerdo que tu pago de mensualidad de ${formatted} correspondiente al periodo ${period}/${month}/${year} esta pendiente. Por favor realiza tu pago. Gracias!`;
  };

  const copyToClipboard = async (text: string, playerId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(playerId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Error copying:', err);
    }
  };

  const openWhatsApp = (phone: string, message: string) => {
    const encodedMessage = encodeURIComponent(message);
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
  };

  const pendingPlayers = getPendingPlayers();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos de Transferencia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <img
              src="/DatosDeTransferencia_Mensualidad.png"
              alt="Datos de Transferencia"
              className="max-w-full h-auto rounded-lg shadow-md"
              style={{ maxHeight: '400px' }}
            />
            <p className="text-sm text-muted-foreground text-center">
              Imagen con datos bancarios para transferencia
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jugadores con Pago Pendiente</CardTitle>
          <p className="text-sm text-muted-foreground">
            Periodo actual: {getCurrentPeriod()} / {getCurrentMonth()} / {getCurrentYear()}
          </p>
        </CardHeader>
        <CardContent>
          {pendingPlayers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay pagos pendientes!
            </p>
          ) : (
            <div className="space-y-4">
              {pendingPlayers.map((player) => {
                const message = generateMessage(player);
                const isCopied = copiedId === player.id;

                return (
                  <div
                    key={player.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg gap-3"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{player.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{player.category}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Intl.NumberFormat('es-MX', {
                            style: 'currency',
                            currency: 'MXN',
                          }).format(CATEGORY_AMOUNTS[player.category])}
                        </span>
                      </div>
                      {player.phone && (
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {player.phone}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(message, player.id)}
                        className="flex-1 sm:flex-none"
                      >
                        {isCopied ? (
                          <Check className="h-4 w-4 mr-1 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 mr-1" />
                        )}
                        {isCopied ? 'Copiado!' : 'Copiar'}
                      </Button>
                      {player.phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openWhatsApp(player.phone, message)}
                          className="flex-1 sm:flex-none text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          WhatsApp
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
