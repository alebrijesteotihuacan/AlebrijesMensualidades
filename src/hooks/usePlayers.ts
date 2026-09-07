import { useState, useEffect, useCallback } from 'react';
import { playersService } from '@/services/players';
import { type Player, type Category } from '@/types';

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlayers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await playersService.getAll();
      setPlayers(data);
    } catch (err) {
      setError('Error al cargar jugadores');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const addPlayer = async (player: Omit<Player, 'id' | 'createdAt'>) => {
    try {
      await playersService.create(player);
      await fetchPlayers();
    } catch (err) {
      setError('Error al agregar jugador');
      throw err;
    }
  };

  const updatePlayer = async (id: string, player: Partial<Omit<Player, 'id' | 'createdAt'>>) => {
    try {
      await playersService.update(id, player);
      await fetchPlayers();
    } catch (err) {
      setError('Error al actualizar jugador');
      throw err;
    }
  };

  const deletePlayer = async (id: string) => {
    try {
      await playersService.delete(id);
      await fetchPlayers();
    } catch (err) {
      setError('Error al eliminar jugador');
      throw err;
    }
  };

  const getPlayersByCategory = (category: Category) => {
    return players.filter((p) => p.category === category);
  };

  return {
    players,
    loading,
    error,
    addPlayer,
    updatePlayer,
    deletePlayer,
    getPlayersByCategory,
    refresh: fetchPlayers,
  };
}
