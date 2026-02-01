import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DuelForm } from '../../components/duels/DuelForm';

export const CreateDuelPage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleDuelCreated = async (duelId: string) => {
    // Navigate immediately to the duel page/lobby
    navigate(`/duels/${duelId}`);
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

        <DuelForm onDuelCreated={handleDuelCreated} onError={setError} />

        {error && (
          <div className="bg-pump-gray-darker border-2 border-pump-red rounded-lg p-4 mt-6">
            <p className="text-pump-red font-sans">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
