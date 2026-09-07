import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePlayers } from '@/hooks/usePlayers';
import { usePayments } from '@/hooks/usePayments';
import { PaymentForm } from '@/components/payments/PaymentForm';
import { PaymentHistory } from '@/components/payments/PaymentHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type PaymentPeriod, type Category, CATEGORIES, MONTHS } from '@/types';
import { Plus, Search, Download } from 'lucide-react';

export function PaymentsPage() {
  const { players } = usePlayers();
  const { payments, loading, error, addPayment, markAsPaid, deletePayment } = usePayments();
  const [searchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [monthFilter, setMonthFilter] = useState<string>((new Date().getMonth() + 1).toString());
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());

  const playerIdFromUrl = searchParams.get('playerId');

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const matchesSearch =
        payment.playerName.toLowerCase().includes(search.toLowerCase()) ||
        payment.category.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || payment.category === categoryFilter;
      const matchesMonth = payment.month === parseInt(monthFilter);
      const matchesYear = payment.year === parseInt(yearFilter);
      const matchesPlayer = !playerIdFromUrl || payment.playerId === playerIdFromUrl;

      return matchesSearch && matchesStatus && matchesCategory && matchesMonth && matchesYear && matchesPlayer;
    });
  }, [payments, search, statusFilter, categoryFilter, monthFilter, yearFilter, playerIdFromUrl]);

  const handleSave = async (paymentData: {
    playerId: string;
    playerName: string;
    category: Category;
    period: PaymentPeriod;
    month: number;
    year: number;
    amount: number;
    status: 'pendiente';
    paidDate: null;
  }) => {
    await addPayment(paymentData);
  };

  const handleMarkAsPaid = async (id: string) => {
    await markAsPaid(id);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Estas seguro de eliminar este pago?')) {
      await deletePayment(id);
    }
  };

  const handleExport = () => {
    const headers = ['Jugador', 'Categoria', 'Periodo', 'Monto', 'Estado', 'Fecha Pago'];
    const rows = filteredPayments.map((p) => [
      p.playerName,
      p.category,
      `${p.period}/${p.month}/${p.year}`,
      p.amount,
      p.status,
      p.paidDate ? p.paidDate.toLocaleDateString() : '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagos_${monthFilter}_${yearFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cargando pagos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pagos</h1>
          <p className="text-muted-foreground">
            {filteredPayments.length} pago(s) encontrado(s)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Registrar Pago
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por jugador o categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pagado">Pagado</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="moroso">Moroso</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as Category | 'all')}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, index) => (
              <SelectItem key={index} value={(index + 1).toString()}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-full sm:w-[100px]">
            <SelectValue placeholder="Ano" />
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

      <PaymentHistory
        payments={filteredPayments}
        onMarkAsPaid={handleMarkAsPaid}
        onDelete={handleDelete}
      />

      <PaymentForm
        players={players}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
