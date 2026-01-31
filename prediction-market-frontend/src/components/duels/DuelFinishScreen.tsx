import React from 'react';
import type { DuelResult } from '../../types/duel';
import { CURRENCY_LABELS, DIRECTION_LABELS } from '../../types/duel';

interface DuelFinishScreenProps {
  result: DuelResult;
  currentUserId: string;
  onPlayAgain: () => void;
  onShare: () => void;
}

export const DuelFinishScreen: React.FC<DuelFinishScreenProps> = ({
  result,
  currentUserId,
  onPlayAgain,
  onShare,
}) => {
  const isWinner = result.winnerId === currentUserId;
  const priceWentUp = result.exitPrice > result.entryPrice;

  const formatPrice = (price: number) => {
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const formatPriceChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(4)}`;
  };

  const formatPercent = (pct: number) => {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
  };

  return (
    <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg overflow-hidden animate-fade-in">
      {/* Result Banner */}
      <div
        className={`p-8 text-center ${
          isWinner
            ? 'bg-gradient-to-b from-pump-green/20 to-transparent'
            : 'bg-gradient-to-b from-pump-red/20 to-transparent'
        }`}
      >
        <div
          className={`text-6xl font-mono font-bold mb-2 ${
            isWinner ? 'text-pump-green' : 'text-pump-red'
          }`}
        >
          {isWinner ? 'YOU WIN!' : 'YOU LOSE'}
        </div>
        <p className="text-pump-gray-light font-sans">
          {isWinner
            ? 'Congratulations! Your prediction was correct.'
            : 'Better luck next time!'}
        </p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Players */}
        <div className="flex items-center justify-between">
          {/* Winner */}
          <div className="flex-1 text-center">
            <div className="w-14 h-14 bg-pump-green/20 border-2 border-pump-green rounded-full flex items-center justify-center mx-auto mb-2 text-2xl">
              {result.winnerAvatar || '👑'}
            </div>
            <p className="text-pump-green font-sans font-semibold text-sm">
              {result.winnerUsername}
            </p>
            <p className="text-pump-gray font-sans text-xs">Winner</p>
          </div>

          {/* VS */}
          <div className="px-4">
            <span className="text-pump-gray font-mono text-lg">vs</span>
          </div>

          {/* Loser */}
          <div className="flex-1 text-center">
            <div className="w-14 h-14 bg-pump-red/20 border-2 border-pump-red rounded-full flex items-center justify-center mx-auto mb-2 text-2xl">
              {result.loserAvatar || '👤'}
            </div>
            <p className="text-pump-red font-sans font-semibold text-sm">
              {result.loserUsername}
            </p>
            <p className="text-pump-gray font-sans text-xs">Loser</p>
          </div>
        </div>

        {/* Price Movement */}
        <div className="bg-pump-black border border-pump-gray-dark rounded-lg p-4">
          <p className="text-pump-gray font-sans text-xs mb-3 text-center">
            Price Movement
          </p>

          <div className="flex items-center justify-between mb-3">
            <div className="text-center">
              <p className="text-pump-gray font-sans text-xs">Entry</p>
              <p className="text-pump-white font-mono font-bold">
                ${formatPrice(result.entryPrice)}
              </p>
            </div>

            {/* Arrow */}
            <div className="flex-1 px-4">
              <div className="flex items-center justify-center">
                <div className="h-px bg-pump-gray-dark flex-1" />
                <span
                  className={`mx-2 font-mono text-lg ${
                    priceWentUp ? 'text-pump-green' : 'text-pump-red'
                  }`}
                >
                  {priceWentUp ? '↑' : '↓'}
                </span>
                <div className="h-px bg-pump-gray-dark flex-1" />
              </div>
            </div>

            <div className="text-center">
              <p className="text-pump-gray font-sans text-xs">Exit</p>
              <p className="text-pump-white font-mono font-bold">
                ${formatPrice(result.exitPrice)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <span
              className={`font-mono text-sm ${
                result.priceChange >= 0 ? 'text-pump-green' : 'text-pump-red'
              }`}
            >
              {formatPriceChange(result.priceChange)}
            </span>
            <span
              className={`font-mono text-sm ${
                result.priceChangePercent >= 0
                  ? 'text-pump-green'
                  : 'text-pump-red'
              }`}
            >
              ({formatPercent(result.priceChangePercent)})
            </span>
            <span className="text-pump-gray-light font-sans text-xs">
              Bet: {DIRECTION_LABELS[result.direction]}
            </span>
          </div>
        </div>

        {/* Amount Won */}
        <div
          className={`border rounded-lg p-4 text-center ${
            isWinner
              ? 'bg-pump-green/10 border-pump-green/30'
              : 'bg-pump-red/10 border-pump-red/30'
          }`}
        >
          <p className="text-pump-gray font-sans text-xs mb-1">
            {isWinner ? 'You Won' : 'You Lost'}
          </p>
          <p
            className={`text-3xl font-mono font-bold ${
              isWinner ? 'text-pump-green' : 'text-pump-red'
            }`}
          >
            {isWinner ? '+' : '-'}
            {result.amountWon.toLocaleString()}{' '}
            {CURRENCY_LABELS[result.currency]}
          </p>
          <p className="text-pump-gray font-sans text-xs mt-1">
            Duration: {result.durationSeconds}s
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onPlayAgain}
            className="flex-1 bg-pump-green hover:bg-pump-lime text-pump-black font-sans font-semibold py-3 px-4 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-glow"
          >
            Play Again
          </button>
          <button
            onClick={onShare}
            className="flex-1 bg-pump-cyan/20 hover:bg-pump-cyan/30 border border-pump-cyan/50 text-pump-cyan font-sans font-semibold py-3 px-4 rounded-md transition-all duration-200"
          >
            Share on X
          </button>
        </div>
      </div>
    </div>
  );
};
