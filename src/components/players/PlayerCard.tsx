import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Player, CATEGORY_AMOUNTS } from '@/types';
import { Pencil, Trash2, Phone, FileText } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  onEdit: (player: Player) => void;
  onDelete: (id: string) => void;
  onViewPayments: (playerId: string) => void;
}

export function PlayerCard({ player, onEdit, onDelete, onViewPayments }: PlayerCardProps) {
  const amount = CATEGORY_AMOUNTS[player.category];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Alebrijes Teotihuacan':
        return 'bg-purple-100 text-purple-800';
      case 'Soles Teotihuacan':
        return 'bg-orange-100 text-orange-800';
      case 'Sub-18':
        return 'bg-blue-100 text-blue-800';
      case 'Sub-16':
        return 'bg-green-100 text-green-800';
      case 'Sub-14':
        return 'bg-pink-100 text-pink-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg leading-none">{player.name}</h3>
            <Badge className={getCategoryColor(player.category)}>
              {player.category}
            </Badge>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Mensualidad</p>
            <p className="text-lg font-bold">{formatCurrency(amount)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-2 text-sm">
          {player.phone && (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{player.phone}</span>
            </div>
          )}
          {player.notes && (
            <div className="flex items-start space-x-2 text-muted-foreground">
              <FileText className="h-4 w-4 mt-0.5" />
              <span className="line-clamp-2">{player.notes}</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewPayments(player.id)}
        >
          Ver Pagos
        </Button>
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(player)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(player.id)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
