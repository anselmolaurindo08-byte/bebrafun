import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DuelForm } from '../../components/duels/DuelForm';
import { DuelWaitingRoom } from '../../components/duels/DuelWaitingRoom';
import type { Duel } from '../../types/duel';
import { duelService } from '../../services/duelService';

export const CreateDuelPage: React.FC = () => {
  const navigate = useNavigate();
  const [duel, setDuel] = useState<Duel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDuelCreated = async (duelId: string) => {
    try {
      const createdDuel = await duelService.getDuel(duelId);
      setDuel(createdDuel);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create duel');
    }
  };

  const handleMatched = () => {
    if (duel) {
      navigate(`/duels/${duel.id}`);
    }
  };

  const handleExpired = () => {
    setError('Duel expired. No opponent found.');
    setDuel(null);
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/duels')}
          className="text-gray-400 hover:text-white mb-6 transition"
        >
          ← Back to Duels
        </button>

        {!duel ? (
          <DuelForm onDuelCreated={handleDuelCreated} onError={setError} />
        ) : (
          <DuelWaitingRoom duel={duel} onMatched={handleMatched} onExpired={handleExpired} />
        )}

        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mt-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
