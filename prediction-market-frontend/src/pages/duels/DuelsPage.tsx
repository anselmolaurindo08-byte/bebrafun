import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../store/userStore';
import { DuelCard } from '../../components/duels/DuelCard';
import AuthModal from '../../components/AuthModal';
import { useActiveDuelsPolling } from '../../hooks/useDuelPolling';

export const DuelsPage: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Use polling hook for automatic updates (every 15 seconds)
  const { duels, loading, error } = useActiveDuelsPolling(15000, isAuthenticated);

  const handleCreateDuel = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    navigate('/duels/create');
  };

  return (
    <div className="min-h-screen bg-pump-black px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-mono font-bold text-pump-white">Duels</h1>
          <button
            onClick={handleCreateDuel}
            className="bg-pump-green hover:bg-pump-lime text-pump-black font-semibold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-glow"
          >
            {isAuthenticated ? '+ Create New Duel' : 'Login to Duel'}
          </button>
        </div>

        {/* Info Banner for Unauthenticated Users */}
        {!isAuthenticated && (
          <div className="bg-pump-gray-darker border-2 border-pump-cyan/30 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-mono font-bold text-pump-cyan mb-2">Welcome to Duels!</h2>
            <p className="text-pump-gray-light font-sans mb-4">
              Challenge other players in 1v1 prediction battles. Login to create and join duels.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-pump-green hover:bg-pump-lime text-pump-black font-semibold py-2 px-6 rounded-md transition-all duration-200 hover:scale-105"
            >
              Login to Get Started
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-16">
            <div className="w-12 h-12 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow mx-auto"></div>
            <p className="text-pump-gray-light font-sans mt-4">Loading duels...</p>
          </div>
        )}

        {error && (
          <div className="bg-pump-gray-darker border-2 border-pump-red rounded-lg p-4 mb-6">
            <p className="text-pump-red font-sans">{error}</p>
          </div>
        )}

        {!loading && isAuthenticated && duels.length === 0 && (
          <div className="text-center py-16 bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg">
            <div className="text-6xl mb-4">⚔️</div>
            <h2 className="text-2xl font-mono font-bold text-pump-white mb-2">No Duels Yet</h2>
            <p className="text-pump-gray-light font-sans mb-6">Be the first to create a duel and challenge others!</p>
            <button
              onClick={() => navigate('/duels/create')}
              className="bg-pump-green hover:bg-pump-lime text-pump-black font-semibold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-glow"
            >
              Create First Duel
            </button>
          </div>
        )}

        {!loading && isAuthenticated && duels.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {duels.map((duel) => (
              <DuelCard key={duel.id} duel={duel} />
            ))}
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
};
