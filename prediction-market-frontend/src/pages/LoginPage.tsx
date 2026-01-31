import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import AuthModal from '../components/AuthModal';

export default function LoginPage() {
    const { user, token } = useUserStore();
    const navigate = useNavigate();

    const isFullyAuthenticated = !!token && !!user?.wallet_address;

    useEffect(() => {
        if (isFullyAuthenticated) {
            navigate('/');
        }
    }, [isFullyAuthenticated, navigate]);

    return (
        <div className="min-h-screen bg-pump-black flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="text-6xl mb-4">📊</div>
                    <h1 className="text-5xl font-mono font-bold text-pump-green mb-2"
                        style={{ textShadow: '0 0 20px rgba(0, 255, 65, 0.5)' }}>
                        PUMPSLY
                    </h1>
                    <p className="text-pump-gray-light text-lg font-sans">Season 0</p>
                </div>

                {/* Auth Modal (always open on this page) */}
                <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg hover:border-pump-green transition-all duration-300">
                    <div className="p-8">
                        <AuthModal
                            isOpen={true}
                            onClose={() => navigate('/')}
                        />
                    </div>
                </div>

                {/* Features */}
                <div className="mt-8 grid grid-cols-3 gap-6">
                    <div className="text-center">
                        <p className="text-3xl mb-3">💰</p>
                        <p className="text-xs text-pump-gray-light font-sans">Real Tokens</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl mb-3">🎯</p>
                        <p className="text-xs text-pump-gray-light font-sans">Predict Events</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl mb-3">🏆</p>
                        <p className="text-xs text-pump-gray-light font-sans">Win on Devnet</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
