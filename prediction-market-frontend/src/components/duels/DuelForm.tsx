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
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      <h2 className="text-2xl font-bold text-white mb-6">Create New Duel</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Bet Amount (Tokens)
          </label>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            min="1"
            step="1000"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            placeholder="Enter bet amount"
            disabled={loading}
          />
          <p className="text-xs text-gray-400 mt-1">Minimum: 1 token</p>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-3">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition"
        >
          {loading ? 'Creating Duel...' : 'Create Duel'}
        </button>
      </form>
    </div>
  );
};
