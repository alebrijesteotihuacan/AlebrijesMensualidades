import { useState, useEffect, useCallback } from 'react';
import { paymentsService } from '@/services/payments';
import { type Payment, type PaymentPeriod, type Player } from '@/types';

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await paymentsService.getAll();
      setPayments(data);
    } catch (err) {
      setError('Error al cargar pagos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const addPayment = async (payment: Omit<Payment, 'id' | 'createdAt'>) => {
    try {
      await paymentsService.create(payment);
      await fetchPayments();
    } catch (err) {
      setError('Error al agregar pago');
      throw err;
    }
  };

  const updatePayment = async (id: string, payment: Partial<Omit<Payment, 'id' | 'createdAt'>>) => {
    try {
      await paymentsService.update(id, payment);
      await fetchPayments();
    } catch (err) {
      setError('Error al actualizar pago');
      throw err;
    }
  };

  const deletePayment = async (id: string) => {
    try {
      await paymentsService.delete(id);
      await fetchPayments();
    } catch (err) {
      setError('Error al eliminar pago');
      throw err;
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      await paymentsService.markAsPaid(id);
      await fetchPayments();
    } catch (err) {
      setError('Error al marcar como pagado');
      throw err;
    }
  };

  const generatePayments = async (
    players: Pick<Player, 'id' | 'name' | 'category'>[],
    period: PaymentPeriod,
    month: number,
    year: number
  ) => {
    try {
      await paymentsService.generatePaymentsForPeriod(players, period, month, year);
      await fetchPayments();
    } catch (err) {
      setError('Error al generar pagos');
      throw err;
    }
  };

  const getPaymentsByPlayer = (playerId: string) => {
    return payments.filter((p) => p.playerId === playerId);
  };

  const getPaymentsByMonthYear = (month: number, year: number) => {
    return payments.filter((p) => p.month === month && p.year === year);
  };

  return {
    payments,
    loading,
    error,
    addPayment,
    updatePayment,
    deletePayment,
    markAsPaid,
    generatePayments,
    getPaymentsByPlayer,
    getPaymentsByMonthYear,
    refresh: fetchPayments,
  };
}
