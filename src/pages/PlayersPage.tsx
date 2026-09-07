import { useState } from 'react';
import { usePlayers } from '@/hooks/usePlayers';
import { PlayerGrid } from '@/components/players/PlayerGrid';
import { PlayerForm } from '@/components/players/PlayerForm';
import { PlayerFilters } from '@/components/players/PlayerFilters';
import { Button } from '@/components/ui/button';
import { type Player, type Category } from '@/types';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PlayersPage() {
  const { players, loading, error, addPlayer, updatePlayer, deletePlayer } = usePlayers();
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const navigate = useNavigate();

  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || player.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleSave = async (playerData: Omit<Player, 'id' | 'createdAt'>) => {
    if (editingPlayer) {
      await updatePlayer(editingPlayer.id, playerData);
    } else {
      await addPlayer(playerData);
    }
    setEditingPlayer(null);
  };

  const handleEdit = (player: Player) => {
    setEditingPlayer(player);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Estas seguro de eliminar este jugador?')) {
      await deletePlayer(id);
    }
  };

  const handleViewPayments = (playerId: string) => {
    navigate(`/pagos?playerId=${playerId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cargando jugadores...</p>
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
          <h1 className="text-3xl font-bold tracking-tight">Jugadores</h1>
          <p className="text-muted-foreground">
            {filteredPlayers.length} jugador(es) encontrado(s)
          </p>
        </div>
        <Button onClick={() => { setEditingPlayer(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Jugador
        </Button>
      </div>

      <PlayerFilters
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
      />

      <PlayerGrid
        players={filteredPlayers}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onViewPayments={handleViewPayments}
      />

      <PlayerForm
        player={editingPlayer}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingPlayer(null); }}
        onSave={handleSave}
      />
    </div>
  );
}
