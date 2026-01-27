import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DuelArena } from '../../components/duels/DuelArena';
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading duel...</p>
        </div>
      </div>
    );
  }

  if (!activeDuel) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/duels')}
            className="text-gray-400 hover:text-white mb-6 transition"
          >
            ← Back to Duels
          </button>
          <div className="bg-red-900 border border-red-700 rounded-lg p-4">
            <p className="text-red-200">Duel not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/duels')}
          className="text-gray-400 hover:text-white mb-6 transition"
        >
          ← Back to Duels
        </button>

        <DuelArena duel={activeDuel} onResolved={() => navigate('/duels')} />

        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mt-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
