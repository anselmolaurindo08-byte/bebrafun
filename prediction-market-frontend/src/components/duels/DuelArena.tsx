import React, { useState } from 'react';
import type { Duel } from '../../types/duel';
import { DuelStatus, DUEL_STATUS_LABELS } from '../../types/duel';
import { DepositFlow } from './DepositFlow';
import { DuelGameView } from './DuelGameView';
import { useUserStore } from '../../store/userStore';
import { duelService } from '../../services/duelService';
import { useDuelPolling } from '../../hooks/useDuelPolling';
import { useBlockchainWallet } from '../../hooks/useBlockchainWallet';
import { getMarketId } from '../../utils/duelHelpers';

interface DuelArenaProps {
  duel: Duel;
  onResolved: () => void;
}

export const DuelArena: React.FC<DuelArenaProps> = ({ duel: initialDuel, onResolved }) => {
  const { user } = useUserStore();
  const { publicKey, sendTransaction, blockchainService } = useBlockchainWallet();
  const [showDepositFlow, setShowDepositFlow] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use polling hook for automatic updates (every 3 seconds)
  const { duel: polledDuel } = useDuelPolling(initialDuel.id, 3000, true);

  // Use polled duel if available, otherwise use initial
  const duel = polledDuel || initialDuel;

  const currentUserId = user?.id?.toString();
  const isPlayer1 = currentUserId === String(duel.player1Id);
  const isPlayer2 = currentUserId === String(duel.player2Id);
  const isParticipant = isPlayer1 || isPlayer2;
  const canJoin = !isParticipant && duel.status === DuelStatus.PENDING && !duel.player2Id;

  // Check deposit status based on backend data
  const player1Deposited = duel.player1Deposited || false;
  const player2Deposited = duel.player2Deposited || false;

  const iHaveDeposited = (isPlayer1 && player1Deposited) || (isPlayer2 && player2Deposited);
  // const opponentDeposited = (isPlayer1 && player2Deposited) || (isPlayer2 && player1Deposited);

  // Assuming backend provides these fields, or we check contract state
  // Keep DuelGameView mounted for ACTIVE and RESOLVED status so result modal can show
  const isActive = duel.status === DuelStatus.ACTIVE || duel.status === DuelStatus.RESOLVED;

  const handleDepositComplete = (_signature: string) => {
    // Ideally refetch duel to check backend confirmation status
    setShowDepositFlow(false);
    // Removed window.location.reload() to prevent loop
    // Instead we should rely on state update or explicit refetch
    // onResolved(); // or similar if available
  };

  const handleJoinDuel = async () => {
    try {
      setIsJoining(true);
      setError(null);

      if (!publicKey || !sendTransaction) {
        setError('Please connect your wallet first');
        return;
      }

      // Call smart contract to join duel (this handles SOL transfer to escrow)
      // Need to get the duel's predicted outcome for player 1, then choose opposite
      const player1Prediction = duel.predictedOutcome; // "UP" or "DOWN"
      const player2Prediction = player1Prediction === 'UP' ? 0 : 1; // Opposite: 0 = DOWN, 1 = UP

      console.log('[DuelArena] Calling joinDuel:', { duelId: duel.duelId, prediction: player2Prediction });

      const result = await blockchainService.joinDuel(
        duel.duelId, // On-chain duel ID
        player2Prediction
      );

      console.log('[DuelArena] Join duel result:', result);

      if (!result.success || !result.tx) {
        console.error('[DuelArena] Join duel failed:', result.error);
        throw new Error(result.error || 'Failed to join duel on-chain');
      }

      const signature = result.tx;
      console.log('[DuelArena] Joined duel on-chain, signature:', signature);

      // Update backend with on-chain signature
      console.log('[DuelArena] Calling backend API to join duel:', { duelId: duel.id, signature });
      const updatedDuel = await duelService.joinDuel(duel.id, signature);
      console.log('[DuelArena] Backend API response:', updatedDuel);

      // Save player2Id to localStorage for winner check
      if (updatedDuel.player2Id) {
        localStorage.setItem('userId', String(updatedDuel.player2Id));
        console.log('[DuelArena] Saved userId to localStorage:', updatedDuel.player2Id);
      }

      window.location.reload();
    } catch (err: any) {
      console.error('Failed to join duel:', err);
      setError(err.response?.data?.error || err.message || 'Failed to join duel');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCancelDuel = async () => {
    try {
      setError(null);

      // Step 1: Call smart contract directly - user signs with their wallet for refund
      console.log('[DuelArena] Calling smart contract cancelDuel for duelId:', duel.duelId);
      const result = await blockchainService.cancelDuel(duel.duelId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel duel on-chain');
      }

      console.log('✅ Duel cancelled on-chain, refund tx:', result.tx);

      // Step 2: Update backend status after on-chain success
      await duelService.cancelDuel(duel.id);

      // Navigate back to duels list
      onResolved();
    } catch (err: any) {
      console.error('Failed to cancel duel:', err);
      setError(err.response?.data?.error || err.message || 'Failed to cancel duel');
    }
  };

  // Convert lamports to SOL for display
  const displayAmount = duel.betAmount / 1e9;

  if (showDepositFlow) {
    return (
      <DepositFlow
        duel={{ ...duel, betAmount: displayAmount }} // Pass formatted amount
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
      <h2 className="text-2xl font-mono font-bold text-pump-white mb-2 text-center">Duel Arena</h2>
      {(() => {
        const marketId = getMarketId(duel);
        return marketId ? (
          <p className="text-pump-gray font-sans text-sm text-center mb-6">
            📊 Chart: {marketId === 1 ? 'SOL/USDT' : marketId === 2 ? 'PUMP/USDT' : `Market #${marketId}`}
          </p>
        ) : null;
      })()}

      {/* Players */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Player 1 */}
        <div className={`bg-pump-black rounded-lg p-6 border-2 ${isPlayer1 ? 'border-pump-green shadow-[0_0_15px_rgba(0,255,65,0.2)]' : 'border-pump-gray-dark'}`}>
          <div className="text-center mb-4">
            <div className="w-16 h-16 bg-pump-gray-dark rounded-full mx-auto mb-2 flex items-center justify-center text-2xl">
              👤
            </div>
            <p className="text-pump-white font-sans font-bold">
              {duel.player1Username || 'Player 1'}
              {isPlayer1 && <span className="ml-2 text-pump-green text-xs font-mono border border-pump-green rounded px-1">(YOU)</span>}
            </p>
            <p className="text-xs text-pump-green mt-1">
              {(() => {
                // Fallback: if predictedOutcome is not set, derive from direction
                const outcome = duel.predictedOutcome || (duel.direction === 0 ? 'UP' : 'DOWN');
                return outcome === 'UP' ? '▲ HIGHER' : '▼ LOWER';
              })()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-pump-gray font-sans text-sm mb-1">Bet Amount</p>
            <p className="text-2xl font-mono font-bold text-pump-green">
              {displayAmount} {typeof duel.currency === 'number' ? (duel.currency === 0 ? 'SOL' : duel.currency === 1 ? 'PUMP' : 'USDC') : duel.currency}
            </p>
          </div>
          {player1Deposited && (
            <div className="mt-4 bg-pump-gray-darker border-2 border-pump-green rounded p-2 text-center">
              <p className="text-pump-green font-sans text-sm">✓ Ready</p>
            </div>
          )}
        </div>

        {/* Player 2 */}
        {duel.player2Id ? (
          <div className={`bg-pump-black rounded-lg p-6 border-2 ${isPlayer2 ? 'border-pump-green shadow-[0_0_15px_rgba(0,255,65,0.2)]' : 'border-pump-gray-dark'}`}>
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-pump-gray-dark rounded-full mx-auto mb-2 flex items-center justify-center text-2xl">
                👤
              </div>
              <p className="text-pump-white font-sans font-bold">
                {duel.player2Username || 'Player 2'}
                {isPlayer2 && <span className="ml-2 text-pump-green text-xs font-mono border border-pump-green rounded px-1">(YOU)</span>}
              </p>
              <p className="text-xs text-pump-red mt-1">
                {(() => {
                  // Fallback: if predictedOutcome is not set, derive from direction
                  const outcome = duel.predictedOutcome || (duel.direction === 0 ? 'UP' : 'DOWN');
                  // Player 2 has opposite prediction
                  return outcome === 'UP' ? '▼ LOWER' : '▲ HIGHER';
                })()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-pump-gray font-sans text-sm mb-1">Bet Amount</p>
              <p className="text-2xl font-mono font-bold text-pump-green">
                {displayAmount} {typeof duel.currency === 'number' ? (duel.currency === 0 ? 'SOL' : duel.currency === 1 ? 'PUMP' : 'USDC') : duel.currency}
              </p>
            </div>
            {player2Deposited && (
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
        {isParticipant && !isActive && (
          <p className="text-sm text-pump-gray-light mt-2">
            {iHaveDeposited
              ? "Waiting for opponent to deposit..."
              : "Action required: Deposit funds to start!"}
          </p>
        )}
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
      ) : isPlayer1 && duel.status === DuelStatus.PENDING && !duel.player2Id ? (
        <button
          onClick={() => {
            if (confirm('Are you sure you want to cancel this duel? Your deposit will be refunded.')) {
              handleCancelDuel();
            }
          }}
          className="w-full bg-pump-red hover:bg-red-600 text-white font-sans font-semibold py-3 px-4 rounded-md transition-all duration-200 hover:scale-105"
        >
          CANCEL DUEL
        </button>
      ) : isParticipant && duel.status === DuelStatus.MATCHED && !iHaveDeposited ? (
        <button
          onClick={() => setShowDepositFlow(true)}
          className="w-full bg-pump-green hover:bg-pump-lime text-pump-black font-sans font-semibold py-3 px-4 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-glow animate-pulse"
        >
          DEPOSIT FUNDS ({displayAmount} {typeof duel.currency === 'number' ? (duel.currency === 0 ? 'SOL' : duel.currency === 1 ? 'PUMP' : 'USDC') : duel.currency})
        </button>
      ) : null}
    </div>
  );
};
