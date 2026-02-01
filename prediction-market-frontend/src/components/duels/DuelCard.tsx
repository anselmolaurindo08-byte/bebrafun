import React from 'react';
import type { Duel } from '../../types/duel';
import { DuelStatus, DUEL_STATUS_LABELS } from '../../types/duel';
import { useNavigate } from 'react-router-dom';

interface DuelCardProps {
  duel: Duel;
}

export const DuelCard: React.FC<DuelCardProps> = ({ duel }) => {
  const navigate = useNavigate();

  const getStatusColor = (status: Duel['status']) => {
    switch (status) {
      case DuelStatus.PENDING:
        return 'bg-pump-yellow text-pump-black';
      case DuelStatus.MATCHED:
        return 'bg-pump-cyan text-pump-black';
      case DuelStatus.ACTIVE:
        return 'bg-pump-lime text-pump-black';
      case DuelStatus.RESOLVED:
        return 'bg-pump-green text-pump-black';
      case DuelStatus.CANCELLED:
        return 'bg-pump-red text-pump-white';
      default:
        return 'bg-pump-gray-dark text-pump-gray-light';
    }
  };

  return (
    <div
      onClick={() => navigate(`/duels/${duel.id}`)}
      className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-5 hover:border-pump-green hover:scale-[1.02] hover:shadow-glow cursor-pointer transition-all duration-200"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-pump-gray-dark rounded-full flex items-center justify-center">
            👤
          </div>
          <span className="text-pump-white font-sans font-semibold">
            {duel.player1Username || 'Player 1'}
          </span>
        </div>
        <span className="text-pump-gray font-mono">vs</span>
        <div className="flex items-center gap-3">
          {duel.player2Id ? (
            <>
              <span className="text-pump-white font-sans font-semibold">
                {duel.player2Username || 'Player 2'}
              </span>
              <div className="w-8 h-8 bg-pump-gray-dark rounded-full flex items-center justify-center">
                👤
              </div>
            </>
          ) : (
            <span className="text-pump-gray font-sans italic">Waiting...</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-pump-gray font-sans text-xs mb-1">Bet Amount</p>
          <p className="text-pump-green font-mono font-bold text-lg">
            {(duel.betAmount / 1_000_000_000).toLocaleString()} {duel.currency === 'SOL' ? 'SOL' : String(duel.currency)}
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-sans font-semibold ${getStatusColor(duel.status)}`}>
          {DUEL_STATUS_LABELS[duel.status] ?? String(duel.status)}
        </div>
      </div>

      {duel.winnerId && (
        <div className="mt-4 pt-4 border-t-2 border-pump-gray-dark">
          <p className="text-pump-gray font-sans text-xs mb-1">Winner</p>
          <p className="text-pump-yellow font-mono font-semibold">
            {duel.winnerId === duel.player1Id ? (duel.player1Username || 'Player 1') : (duel.player2Username || 'Player 2')}
          </p>
        </div>
      )}
    </div>
  );
};
