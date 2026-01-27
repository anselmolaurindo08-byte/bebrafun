import React from 'react';
import type { Duel } from '../../types/duel';
import { useNavigate } from 'react-router-dom';

interface DuelCardProps {
  duel: Duel;
}

export const DuelCard: React.FC<DuelCardProps> = ({ duel }) => {
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-900 text-yellow-200';
      case 'MATCHED':
        return 'bg-blue-900 text-blue-200';
      case 'ACTIVE':
        return 'bg-purple-900 text-purple-200';
      case 'RESOLVED':
        return 'bg-green-900 text-green-200';
      case 'CANCELLED':
        return 'bg-red-900 text-red-200';
      default:
        return 'bg-gray-800 text-gray-200';
    }
  };

  return (
    <div
      onClick={() => navigate(`/duels/${duel.id}`)}
      className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-green-500 cursor-pointer transition"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
            👤
          </div>
          <span className="text-white font-semibold">Player 1</span>
        </div>
        <span className="text-gray-400">vs</span>
        <div className="flex items-center gap-3">
          {duel.player_2_id ? (
            <>
              <span className="text-white font-semibold">Player 2</span>
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                👤
              </div>
            </>
          ) : (
            <span className="text-gray-500 italic">Waiting...</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-xs mb-1">Bet Amount</p>
          <p className="text-green-400 font-bold">{duel.bet_amount.toLocaleString()} Tokens</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(duel.status)}`}>
          {duel.status}
        </div>
      </div>

      {duel.winner_id && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-gray-400 text-xs mb-1">Winner</p>
          <p className="text-yellow-400 font-semibold">
            {duel.winner_id === duel.player_1_id ? 'Player 1' : 'Player 2'}
          </p>
        </div>
      )}
    </div>
  );
};
