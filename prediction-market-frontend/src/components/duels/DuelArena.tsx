import React, { useState } from 'react';
import type { Duel } from '../../types/duel';
import { DepositFlow } from './DepositFlow';
import { useUserStore } from '../../store/userStore';
import { duelService } from '../../services/duelService';

interface DuelArenaProps {
  duel: Duel;
  onResolved: () => void;
}

export const DuelArena: React.FC<DuelArenaProps> = ({ duel, onResolved: _onResolved }) => {
  const { user } = useUserStore();
  const [showDepositFlow, setShowDepositFlow] = useState(false);
  const [depositedPlayers, setDepositedPlayers] = useState<Set<string>>(new Set());
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if current user is a participant
  const currentUserId = user?.id?.toString();
  const isPlayer1 = currentUserId === duel.player_1_id;
  const isPlayer2 = currentUserId === duel.player_2_id;
  const isParticipant = isPlayer1 || isPlayer2;
  const canJoin = !isParticipant && duel.status === 'PENDING' && !duel.player_2_id;

  const handleDepositComplete = (_signature: string) => {
    setDepositedPlayers((prev) => new Set(prev).add(duel.player_1_id));
    setShowDepositFlow(false);
  };

  const handleJoinDuel = async () => {
    try {
      setIsJoining(true);
      setError(null);
      await duelService.joinDuel(duel.id);
      // Refresh page to show updated duel
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
            <p className="text-pump-white font-sans font-bold">Player 1</p>
          </div>
          <div className="text-center">
            <p className="text-pump-gray font-sans text-sm mb-1">Bet Amount</p>
            <p className="text-2xl font-mono font-bold text-pump-green">{duel.player_1_amount.toLocaleString()}</p>
          </div>
          {depositedPlayers.has(duel.player_1_id) && (
            <div className="mt-4 bg-pump-gray-darker border-2 border-pump-green rounded p-2 text-center">
              <p className="text-pump-green font-sans text-sm">✓ Deposited</p>
            </div>
          )}
        </div>

        {/* Player 2 */}
        {duel.player_2_id && (
          <div className="bg-pump-black rounded-lg p-6 border-2 border-pump-gray-dark">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-pump-gray-dark rounded-full mx-auto mb-2 flex items-center justify-center text-2xl">
                👤
              </div>
              <p className="text-pump-white font-sans font-bold">Player 2</p>
            </div>
            <div className="text-center">
              <p className="text-pump-gray font-sans text-sm mb-1">Bet Amount</p>
              <p className="text-2xl font-mono font-bold text-pump-green">
                {duel.player_2_amount?.toLocaleString()}
              </p>
            </div>
            {depositedPlayers.has(duel.player_2_id) && (
              <div className="mt-4 bg-pump-gray-darker border-2 border-pump-green rounded p-2 text-center">
                <p className="text-pump-green font-sans text-sm">✓ Deposited</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 mb-6 text-center">
        <p className="text-pump-gray font-sans text-sm mb-1">Status</p>
        <p className="text-lg font-mono font-bold text-pump-yellow">{duel.status}</p>
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
          {isJoining ? 'Joining...' : 'Join Duel'}
        </button>
      ) : isParticipant && duel.status === 'MATCHED' ? (
        <button
          onClick={() => setShowDepositFlow(true)}
          className="w-full bg-pump-green hover:bg-pump-lime text-pump-black font-sans font-semibold py-3 px-4 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-glow"
        >
          Deposit to Duel
        </button>
      ) : (
        <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-4 text-center">
          <p className="text-pump-gray-light font-sans text-sm">
            {!isParticipant ? 'This duel is not available to join' : 'Waiting for opponent to join'}
          </p>
        </div>
      )}
    </div>
  );
};
