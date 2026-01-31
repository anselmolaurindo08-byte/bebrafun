import React, { useEffect, useState } from 'react';
import type { Duel } from '../../types/duel';
import { DuelStatus } from '../../types/duel';
import { useDuel } from '../../hooks/useDuel';

interface DuelWaitingRoomProps {
  duel: Duel;
  onMatched: () => void;
  onExpired: () => void;
}

export const DuelWaitingRoom: React.FC<DuelWaitingRoomProps> = ({
  duel,
  onMatched,
  onExpired,
}) => {
  const { startPolling, stopPolling } = useDuel();
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes

  useEffect(() => {
    // Start polling for matches
    startPolling(duel.id, 2000);

    // Calculate time left
    const expiresAt = new Date(duel.expiresAt || '').getTime();
    const now = new Date().getTime();
    const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
    setTimeLeft(diff);

    // Countdown timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      stopPolling();
    };
  }, [duel.id]);

  // Check if matched
  useEffect(() => {
    if (duel.status === DuelStatus.MATCHED && duel.player2Id) {
      onMatched();
    }
  }, [duel.status, duel.player2Id]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-8 text-center">
      <h2 className="text-3xl font-mono font-bold text-pump-white mb-6">Waiting for Opponent...</h2>

      <div className="mb-8">
        <div className="inline-block">
          <div className="w-16 h-16 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow"></div>
        </div>
      </div>

      <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-6 mb-6">
        <p className="text-pump-gray-light font-sans mb-2">Your Bet</p>
        <p className="text-3xl font-mono font-bold text-pump-green">{duel.betAmount.toLocaleString()} Tokens</p>
      </div>

      <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 mb-6">
        <p className="text-pump-gray font-sans text-sm mb-2">Time Remaining</p>
        <p className="text-2xl font-mono font-bold text-pump-yellow">{formatTime(timeLeft)}</p>
      </div>

      <p className="text-pump-gray font-sans text-sm">
        Searching for an opponent with the same bet amount...
      </p>
    </div>
  );
};
