import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type Player, type PaymentPeriod, type Category, CATEGORY_AMOUNTS, MONTHS } from '@/types';

interface PaymentFormProps {
  players: Player[];
  open: boolean;
  onClose: () => void;
  onSave: (payment: {
    playerId: string;
    playerName: string;
    category: Category;
    period: PaymentPeriod;
    month: number;
    year: number;
    amount: number;
    status: 'pendiente';
    paidDate: null;
  }) => Promise<void>;
}

export function PaymentForm({ players, open, onClose, onSave }: PaymentFormProps) {
  const [playerId, setPlayerId] = useState('');
  const [period, setPeriod] = useState<PaymentPeriod | ''>('');
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  const selectedPlayer = players.find((p) => p.id === playerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId || !period || !selectedPlayer) return;

    setLoading(true);
    try {
      await onSave({
        playerId,
        playerName: selectedPlayer.name,
        category: selectedPlayer.category,
        period: period as PaymentPeriod,
        month,
        year,
        amount: CATEGORY_AMOUNTS[selectedPlayer.category],
        status: 'pendiente',
        paidDate: null,
      });
      onClose();
      setPlayerId('');
      setPeriod('');
    } catch (error) {
      console.error('Error saving payment:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="player">Jugador</Label>
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar jugador" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name} - {player.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPlayer && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">{selectedPlayer.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPlayer.category} - {formatCurrency(CATEGORY_AMOUNTS[selectedPlayer.category])}
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="period">Período</Label>
              <Select value={period} onValueChange={(value) => setPeriod(value as PaymentPeriod)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-15">1-15</SelectItem>
                  <SelectItem value="16-31">16-31</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="month">Mes</Label>
                <Select value={month.toString()} onValueChange={(value) => setMonth(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, index) => (
                      <SelectItem key={index} value={(index + 1).toString()}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="year">Año</Label>
                <Select value={year.toString()} onValueChange={(value) => setYear(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !playerId || !period}>
              {loading ? 'Guardando...' : 'Registrar Pago'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
