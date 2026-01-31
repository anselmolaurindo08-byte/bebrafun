import React, { useState } from 'react';
import type { Duel } from '../../types/duel';
import { DuelStatus, DUEL_STATUS_LABELS } from '../../types/duel';
import { DepositFlow } from './DepositFlow';
import { DuelGameView } from './DuelGameView';
import { useUserStore } from '../../store/userStore';
import { duelService } from '../../services/duelService';

interface DuelArenaProps {
  duel: Duel;
  onResolved: () => void;
}

export const DuelArena: React.FC<DuelArenaProps> = ({ duel, onResolved }) => {
  const { user } = useUserStore();
  const [showDepositFlow, setShowDepositFlow] = useState(false);
  const [depositedPlayers, setDepositedPlayers] = useState<Set<string>>(new Set());
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = user?.id?.toString();
  const isPlayer1 = currentUserId === duel.player1Id;
  const isPlayer2 = currentUserId === duel.player2Id;
  const isParticipant = isPlayer1 || isPlayer2;
  const canJoin = !isParticipant && duel.status === DuelStatus.PENDING && !duel.player2Id;

  // Assuming backend provides these fields, or we check contract state
  // For demo: checking if status is ACTIVE means everyone deposited
  const isActive = duel.status === DuelStatus.ACTIVE;

  const handleDepositComplete = (_signature: string) => {
    // Ideally refetch duel to check backend confirmation status
    setDepositedPlayers((prev) => new Set(prev).add(currentUserId || ''));
    setShowDepositFlow(false);
    window.location.reload(); // Refresh to see updated status
  };

  const handleJoinDuel = async () => {
    try {
      setIsJoining(true);
      setError(null);
      await duelService.joinDuel(duel.id);
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to join duel:', err);
      setError(err.response?.data?.error || err.message || 'Failed to join duel');
    } finally {
      setIsJoining(false);
    }
  };

  if (showDepositFlow) {
    return (
      <DepositFlow
        duel={duel}
        onComplete={handleDepositComplete}
        onCancel={() => setShowDepositFlow(false)}
      />
    );
  }

  // Active Game View
  if (isActive) {
      return (
          <div className="bg-pump-gray-darker border-2 border-pump-green rounded-lg p-8">
              <h2 className="text-2xl font-mono font-bold text-pump-white mb-4 text-center">
                  DUEL IN PROGRESS
              </h2>
              <DuelGameView duel={duel} onResolved={onResolved} />
          </div>
      );
  }

  return (
    <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-8">
      <h2 className="text-2xl font-mono font-bold text-pump-white mb-8 text-center">Duel Arena</h2>

      {/* Players */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Player 1 */}
        <div className="bg-pump-black rounded-lg p-6 border-2 border-pump-green">
          <div className="text-center mb-4">
            <div className="w-16 h-16 bg-pump-gray-dark rounded-full mx-auto mb-2 flex items-center justify-center text-2xl">
              👤
            </div>
            <p className="text-pump-white font-sans font-bold">{duel.player1Username || 'Player 1'}</p>
            <p className="text-xs text-pump-green mt-1">{duel.predictedOutcome === 'UP' ? '▲ HIGHER' : '▼ LOWER'}</p>
          </div>
          <div className="text-center">
            <p className="text-pump-gray font-sans text-sm mb-1">Bet Amount</p>
            <p className="text-2xl font-mono font-bold text-pump-green">{duel.betAmount} {duel.currency}</p>
          </div>
          {/* Check deposit status logic from backend */}
          {(depositedPlayers.has(duel.player1Id) || duel.status === DuelStatus.MATCHED) && (
             // Simplifying: if matched, P1 probably deposited? or we need explicit flag
             <div className="mt-4 bg-pump-gray-darker border-2 border-pump-green rounded p-2 text-center">
                <p className="text-pump-green font-sans text-sm">✓ Ready</p>
             </div>
          )}
        </div>

        {/* Player 2 */}
        {duel.player2Id ? (
          <div className="bg-pump-black rounded-lg p-6 border-2 border-pump-gray-dark">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-pump-gray-dark rounded-full mx-auto mb-2 flex items-center justify-center text-2xl">
                👤
              </div>
              <p className="text-pump-white font-sans font-bold">{duel.player2Username || 'Player 2'}</p>
              <p className="text-xs text-pump-red mt-1">{duel.predictedOutcome === 'UP' ? '▼ LOWER' : '▲ HIGHER'}</p>
            </div>
            <div className="text-center">
              <p className="text-pump-gray font-sans text-sm mb-1">Bet Amount</p>
              <p className="text-2xl font-mono font-bold text-pump-green">
                {duel.betAmount} {duel.currency}
              </p>
            </div>
            {(depositedPlayers.has(duel.player2Id) || duel.status === DuelStatus.MATCHED) && (
              <div className="mt-4 bg-pump-gray-darker border-2 border-pump-green rounded p-2 text-center">
                <p className="text-pump-green font-sans text-sm">✓ Ready</p>
              </div>
            )}
          </div>
        ) : (
            <div className="bg-pump-black rounded-lg p-6 border-2 border-dashed border-pump-gray-dark flex flex-col items-center justify-center min-h-[200px]">
                <p className="text-pump-gray font-sans mb-4">Waiting for opponent...</p>
                <div className="w-12 h-12 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow"></div>
            </div>
        )}
      </div>

      {/* Status */}
      <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 mb-6 text-center">
        <p className="text-pump-gray font-sans text-sm mb-1">Status</p>
        <p className="text-lg font-mono font-bold text-pump-yellow">
          {DUEL_STATUS_LABELS[duel.status] ?? String(duel.status)}
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-pump-gray-darker border-2 border-pump-red rounded-lg p-4 mb-6">
          <p className="text-pump-red font-sans">{error}</p>
        </div>
      )}

      {/* Actions */}
      {canJoin ? (
        <button
          onClick={handleJoinDuel}
          disabled={isJoining}
          className="w-full bg-pump-green hover:bg-pump-lime text-pump-black font-sans font-semibold py-3 px-4 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isJoining ? 'Joining...' : 'JOIN DUEL'}
        </button>
      ) : isParticipant && (duel.status === DuelStatus.MATCHED || duel.status === DuelStatus.PENDING) ? (
        // Logic check: if PENDING/MATCHED and haven't deposited yet
        // Ideally backend tells us if WE have deposited.
        // For now, showing button always if not active/resolved.
        <button
          onClick={() => setShowDepositFlow(true)}
          className="w-full bg-pump-green hover:bg-pump-lime text-pump-black font-sans font-semibold py-3 px-4 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-glow"
        >
          DEPOSIT FUNDS ({duel.betAmount} SOL)
        </button>
      ) : null}
    </div>
  );
};
