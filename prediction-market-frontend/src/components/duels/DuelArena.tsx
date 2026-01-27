import React, { useState } from 'react';
import type { Duel } from '../../types/duel';
import { DepositFlow } from './DepositFlow';

interface DuelArenaProps {
  duel: Duel;
  onResolved: () => void;
}

export const DuelArena: React.FC<DuelArenaProps> = ({ duel, onResolved: _onResolved }) => {
  const [showDepositFlow, setShowDepositFlow] = useState(false);
  const [depositedPlayers, setDepositedPlayers] = useState<Set<string>>(new Set());

  const handleDepositComplete = (_signature: string) => {
    setDepositedPlayers((prev) => new Set(prev).add(duel.player_1_id));
    setShowDepositFlow(false);
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
    <div className="bg-gray-900 rounded-lg p-8 border border-gray-800">
      <h2 className="text-2xl font-bold text-white mb-8 text-center">Duel Arena</h2>

      {/* Players */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Player 1 */}
        <div className="bg-gray-800 rounded-lg p-6 border-2 border-green-500">
          <div className="text-center mb-4">
            <div className="w-16 h-16 bg-gray-700 rounded-full mx-auto mb-2 flex items-center justify-center text-2xl">
              👤
            </div>
            <p className="text-white font-bold">Player 1</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">Bet Amount</p>
            <p className="text-2xl font-bold text-green-400">{duel.player_1_amount.toLocaleString()}</p>
          </div>
          {depositedPlayers.has(duel.player_1_id) && (
            <div className="mt-4 bg-green-900 border border-green-700 rounded p-2 text-center">
              <p className="text-green-300 text-sm">✓ Deposited</p>
            </div>
          )}
        </div>

        {/* Player 2 */}
        {duel.player_2_id && (
          <div className="bg-gray-800 rounded-lg p-6 border-2 border-gray-700">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-gray-700 rounded-full mx-auto mb-2 flex items-center justify-center text-2xl">
                👤
              </div>
              <p className="text-white font-bold">Player 2</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Bet Amount</p>
              <p className="text-2xl font-bold text-green-400">
                {duel.player_2_amount?.toLocaleString()}
              </p>
            </div>
            {depositedPlayers.has(duel.player_2_id) && (
              <div className="mt-4 bg-green-900 border border-green-700 rounded p-2 text-center">
                <p className="text-green-300 text-sm">✓ Deposited</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6 text-center">
        <p className="text-gray-400 text-sm mb-1">Status</p>
        <p className="text-lg font-bold text-yellow-400">{duel.status}</p>
      </div>

      {/* Actions */}
      <button
        onClick={() => setShowDepositFlow(true)}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition"
      >
        Deposit to Duel
      </button>
    </div>
  );
};
