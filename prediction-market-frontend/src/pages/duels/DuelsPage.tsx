import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { duelService } from '../../services/duelService';
import { DuelCard } from '../../components/duels/DuelCard';
import type { Duel } from '../../types/duel';

export const DuelsPage: React.FC = () => {
  const navigate = useNavigate();
  const [duels, setDuels] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDuels();
  }, []);

  const fetchDuels = async () => {
    try {
      setLoading(true);
      const { duels } = await duelService.getPlayerDuels();
      setDuels(duels);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch duels');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white">Duels</h1>
          <button
            onClick={() => navigate('/duels/create')}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition"
          >
            Create New Duel
          </button>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading duels...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {!loading && duels.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No duels yet. Create one to get started!</p>
            <button
              onClick={() => navigate('/duels/create')}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition"
            >
              Create First Duel
            </button>
          </div>
        )}

        {!loading && duels.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {duels.map((duel) => (
              <DuelCard key={duel.id} duel={duel} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
