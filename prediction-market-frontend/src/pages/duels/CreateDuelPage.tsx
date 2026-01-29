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
    <div className="min-h-screen bg-pump-black px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/duels')}
          className="text-pump-gray-light hover:text-pump-green font-sans mb-6 transition-colors duration-200"
        >
          ← Back to Duels
        </button>

        {!duel ? (
          <DuelForm onDuelCreated={handleDuelCreated} onError={setError} />
        ) : (
          <DuelWaitingRoom duel={duel} onMatched={handleMatched} onExpired={handleExpired} />
        )}

        {error && (
          <div className="bg-pump-gray-darker border-2 border-pump-red rounded-lg p-4 mt-6">
            <p className="text-pump-red font-sans">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
