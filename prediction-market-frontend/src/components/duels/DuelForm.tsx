import React, { useState } from 'react';
import { duelService } from '../../services/duelService';
import { DuelCurrency } from '../../types/duel';
import { useBlockchainWallet } from '../../hooks/useBlockchainWallet';
import type { CreateDuelRequest } from '../../types/duel';

interface DuelFormProps {
  onDuelCreated: (duelId: string) => void;
  onError: (error: string) => void;
}

export const DuelForm: React.FC<DuelFormProps> = ({ onDuelCreated, onError }) => {
  const { balance } = useBlockchainWallet();
  const [betAmount, setBetAmount] = useState<string>('0.1');
  const [selectedToken, setSelectedToken] = useState<DuelCurrency>(DuelCurrency.SOL);
  const [prediction, setPrediction] = useState<'UP' | 'DOWN'>('UP');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(betAmount);

    if (amount <= 0) {
      setError('Bet amount must be positive');
      return;
    }

    if (selectedToken === DuelCurrency.SOL && balance !== null && amount > balance) {
      setError(`Insufficient balance. You have ${balance.toFixed(4)} SOL`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Convert SOL to lamports/units logic usually happens in service, passing float for now
      // Assuming backend handles conversion or expects float
      const request: CreateDuelRequest = {
        betAmount: amount, // Backend expects float for now? Or we should check types.
                           // Current CreateDuelRequest uses number.
        currency: selectedToken,
        predictedOutcome: prediction
      };

      const duel = await duelService.createDuel(request);
      onDuelCreated(duel.id);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create duel';
      setError(errorMsg);
      onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6">
      <h2 className="text-2xl font-mono font-bold text-pump-white mb-6">Create New Duel</h2>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Token Selection */}
        <div>
          <label className="block text-sm font-sans font-medium text-pump-gray-light mb-2">
            Select Price Feed (Graph)
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedToken(DuelCurrency.SOL)}
              className={`flex-1 py-3 rounded-md font-sans font-bold transition-all ${
                selectedToken === DuelCurrency.SOL
                  ? 'bg-pump-purple text-white border-2 border-pump-purple'
                  : 'bg-pump-black text-pump-gray border-2 border-pump-gray-dark hover:border-pump-purple'
              }`}
            >
              SOL/USDT
            </button>
            <button
              type="button"
              onClick={() => setSelectedToken(DuelCurrency.PUMP)}
              className={`flex-1 py-3 rounded-md font-sans font-bold transition-all ${
                selectedToken === DuelCurrency.PUMP
                  ? 'bg-pump-green text-pump-black border-2 border-pump-green'
                  : 'bg-pump-black text-pump-gray border-2 border-pump-gray-dark hover:border-pump-green'
              }`}
            >
              DOGE/USDT (Demo)
            </button>
          </div>
        </div>

        {/* Prediction */}
        <div>
          <label className="block text-sm font-sans font-medium text-pump-gray-light mb-2">
            Prediction (1 min)
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPrediction('UP')}
              className={`flex-1 py-3 rounded-md font-sans font-bold transition-all ${
                prediction === 'UP'
                  ? 'bg-pump-green text-pump-black border-2 border-pump-green shadow-glow'
                  : 'bg-pump-black text-pump-green border-2 border-pump-gray-dark hover:border-pump-green'
              }`}
            >
              ▲ HIGHER
            </button>
            <button
              type="button"
              onClick={() => setPrediction('DOWN')}
              className={`flex-1 py-3 rounded-md font-sans font-bold transition-all ${
                prediction === 'DOWN'
                  ? 'bg-pump-red text-white border-2 border-pump-red'
                  : 'bg-pump-black text-pump-red border-2 border-pump-gray-dark hover:border-pump-red'
              }`}
            >
              ▼ LOWER
            </button>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-sans font-medium text-pump-gray-light mb-2">
            Bet Amount (in SOL)
          </label>
          <div className="relative">
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              min="0.01"
              step="0.01"
              className="input-field w-full pr-12"
              placeholder="0.00"
              disabled={loading}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-pump-gray font-mono">
              SOL
            </span>
          </div>
          {balance !== null && (
            <p className="text-xs text-pump-gray font-sans mt-2 text-right">
              Balance: <span className="text-pump-white cursor-pointer hover:underline" onClick={() => setBetAmount(balance.toString())}>{balance.toFixed(4)} SOL</span>
            </p>
          )}
        </div>

        {error && (
          <div className="bg-pump-black border-2 border-pump-red rounded-lg p-3">
            <p className="text-pump-red font-sans text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-pump-green hover:bg-pump-lime disabled:bg-pump-gray-dark disabled:cursor-not-allowed disabled:text-pump-gray text-pump-black font-sans font-bold py-4 px-4 rounded-md transition-all duration-200 hover:scale-[1.02] hover:shadow-glow text-lg uppercase tracking-wider"
        >
          {loading ? 'Creating Arena...' : 'CREATE DUEL'}
        </button>
      </form>
    </div>
  );
};
