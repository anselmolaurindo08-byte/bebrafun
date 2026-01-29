import React, { useState } from 'react';
import { duelService } from '../../services/duelService';
import type { CreateDuelRequest } from '../../types/duel';

interface DuelFormProps {
  onDuelCreated: (duelId: string) => void;
  onError: (error: string) => void;
}

export const DuelForm: React.FC<DuelFormProps> = ({ onDuelCreated, onError }) => {
  const [betAmount, setBetAmount] = useState<number>(100000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (betAmount <= 0) {
      setError('Bet amount must be positive');
      onError('Bet amount must be positive');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const request: CreateDuelRequest = {
        bet_amount: betAmount,
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
        <div>
          <label className="block text-sm font-sans font-medium text-pump-gray-light mb-2">
            Bet Amount (Tokens)
          </label>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            min="1"
            step="1000"
            className="input-field w-full"
            placeholder="Enter bet amount"
            disabled={loading}
          />
          <p className="text-xs text-pump-gray font-sans mt-1">Minimum: 1 token</p>
        </div>

        {error && (
          <div className="bg-pump-gray-darker border-2 border-pump-red rounded-lg p-3">
            <p className="text-pump-red font-sans text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-pump-green hover:bg-pump-lime disabled:bg-pump-gray-dark disabled:cursor-not-allowed disabled:text-pump-gray text-pump-black font-sans font-semibold py-3 px-4 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-glow"
        >
          {loading ? 'Creating Duel...' : 'Create Duel'}
        </button>
      </form>
    </div>
  );
};
