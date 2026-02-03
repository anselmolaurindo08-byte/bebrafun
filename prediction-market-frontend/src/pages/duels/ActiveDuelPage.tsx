import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DuelArena } from '../../components/duels/DuelArena';
import CancelDuelButton from '../../components/CancelDuelButton';
import { useDuel } from '../../hooks/useDuel';
import { useDuelStore } from '../../store/duelStore';

export const ActiveDuelPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchDuel } = useDuel();
  const { activeDuel, loading, error } = useDuelStore();

  useEffect(() => {
    if (id) {
      fetchDuel(id);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-pump-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow mx-auto mb-4"></div>
          <p className="text-pump-gray-light font-sans">Loading duel...</p>
        </div>
      </div>
    );
  }

  if (!activeDuel) {
    return (
      <div className="min-h-screen bg-pump-black px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/duels')}
            className="text-pump-gray-light hover:text-pump-green font-sans mb-6 transition-colors duration-200"
          >
            ← Back to Duels
          </button>
          <div className="bg-pump-gray-darker border-2 border-pump-red rounded-lg p-4">
            <p className="text-pump-red font-sans">Duel not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pump-black px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/duels')}
          className="text-pump-gray-light hover:text-pump-green font-sans mb-6 transition-colors duration-200"
        >
          ← Back to Duels
        </button>

        <DuelArena duel={activeDuel} onResolved={() => navigate('/duels')} />

        {/* Cancel Duel Button (only for player 1 after 5 min) */}
        <CancelDuelButton
          duel={activeDuel}
          onSuccess={() => navigate('/duels')}
        />

        {error && (
          <div className="bg-pump-gray-darker border-2 border-pump-red rounded-lg p-4 mt-6">
            <p className="text-pump-red font-sans">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
