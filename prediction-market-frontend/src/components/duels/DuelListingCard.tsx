import React, { useEffect, useState } from 'react';
import type { Duel } from '../../types/duel';
import { DuelStatus, CURRENCY_LABELS, DUEL_STATUS_LABELS } from '../../types/duel';

interface DuelListingCardProps {
  duel: Duel;
  onJoin: (duelId: string) => void;
  currentUserId?: string;
}

export const DuelListingCard: React.FC<DuelListingCardProps> = ({
  duel,
  onJoin,
  currentUserId,
}) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!duel.expiresAt) return;

    const updateTimer = () => {
      const now = Date.now();
      const expires = new Date(duel.expiresAt!).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1_000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [duel.expiresAt]);

  const isOwnDuel = currentUserId === duel.player1Id;
  const canJoin = duel.status === DuelStatus.PENDING && !isOwnDuel;

  const getStatusBadgeClasses = () => {
    switch (duel.status) {
      case DuelStatus.PENDING:
        return 'bg-pump-yellow/20 text-pump-yellow border-pump-yellow/30';
      case DuelStatus.MATCHED:
        return 'bg-pump-cyan/20 text-pump-cyan border-pump-cyan/30';
      case DuelStatus.ACTIVE:
        return 'bg-pump-green/20 text-pump-green border-pump-green/30';
      case DuelStatus.EXPIRED:
        return 'bg-pump-red/20 text-pump-red border-pump-red/30';
      default:
        return 'bg-pump-gray-dark/50 text-pump-gray-light border-pump-gray-dark';
    }
  };

  return (
    <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-5 hover:border-pump-green/50 hover:shadow-glow transition-all duration-200">
      {/* Header: Player info + Status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pump-gray-dark rounded-full flex items-center justify-center text-lg">
            {duel.player1Avatar || '👤'}
          </div>
          <div>
            <p className="text-pump-white font-sans font-semibold text-sm">
              {duel.player1Username || 'Anonymous'}
            </p>
            <p className="text-pump-gray font-mono text-xs">
              {duel.player1Id.slice(0, 6)}...{duel.player1Id.slice(-4)}
            </p>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-sans font-semibold border ${getStatusBadgeClasses()}`}
        >
          {DUEL_STATUS_LABELS[duel.status] ?? 'Unknown'}
        </span>
      </div>

      {/* Bet Amount */}
      <div className="bg-pump-black border border-pump-gray-dark rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-pump-gray font-sans text-xs mb-1">Bet Amount</p>
            <p className="text-2xl font-mono font-bold text-pump-green">
              {duel.betAmount.toLocaleString()}
            </p>
          </div>
          <div className="bg-pump-gray-dark px-3 py-1.5 rounded-full">
            <span className="text-pump-white font-mono text-sm font-semibold">
              {/* @ts-expect-error - currency may be number temporarily */}
              {CURRENCY_LABELS[duel.currency] ?? 'SOL'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer: Time + Join */}
      <div className="flex items-center justify-between">
        {duel.expiresAt && timeLeft ? (
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                timeLeft === 'Expired'
                  ? 'bg-pump-red'
                  : 'bg-pump-green animate-blink'
              }`}
            />
            <span
              className={`font-mono text-sm ${
                timeLeft === 'Expired' ? 'text-pump-red' : 'text-pump-gray-light'
              }`}
            >
              {timeLeft}
            </span>
          </div>
        ) : (
          <span className="text-pump-gray font-mono text-sm">--:--</span>
        )}

        {canJoin ? (
          <button
            onClick={() => onJoin(duel.id)}
            className="bg-pump-green hover:bg-pump-lime text-pump-black font-sans font-semibold py-2 px-5 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-glow text-sm"
          >
            Join Duel
          </button>
        ) : isOwnDuel ? (
          <span className="text-pump-gray font-sans text-sm italic">
            Your duel
          </span>
        ) : null}
      </div>
    </div>
  );
};
