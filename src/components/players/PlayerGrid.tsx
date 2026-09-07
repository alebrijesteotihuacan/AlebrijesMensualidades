import { PlayerCard } from './PlayerCard';
import { type Player } from '@/types';

interface PlayerGridProps {
  players: Player[];
  onEdit: (player: Player) => void;
  onDelete: (id: string) => void;
  onViewPayments: (playerId: string) => void;
}

export function PlayerGrid({ players, onEdit, onDelete, onViewPayments }: PlayerGridProps) {
  if (players.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No se encontraron jugadores</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {players.map((player) => (
        <PlayerCard
          key={player.id}
          player={player}
          onEdit={onEdit}
          onDelete={onDelete}
          onViewPayments={onViewPayments}
        />
      ))}
    </div>
  );
}
