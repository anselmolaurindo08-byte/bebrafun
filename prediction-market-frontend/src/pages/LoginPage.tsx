import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import apiService from '../services/api';

export default function LoginPage() {
    const navigate = useNavigate();
    const { isAuthenticated, setLoading } = useUserStore();

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/');
        }
    }, [isAuthenticated, navigate]);

    const handleLoginClick = () => {
        setLoading(true);
        apiService.login();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary to-secondary flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="text-6xl mb-4">📊</div>
                    <h1 className="text-4xl font-bold mb-2">Prediction Market</h1>
                    <p className="text-gray-400 text-lg">Season 0</p>
                </div>

                <div className="bg-secondary rounded-xl p-8 border border-gray-700">
                    <h2 className="text-2xl font-bold mb-4">Welcome</h2>
                    <p className="text-gray-400 mb-6">
                        Sign in with your X.com account to start predicting and earning rewards.
                    </p>

                    <button
                        onClick={handleLoginClick}
                        className="w-full bg-accent hover:bg-green-500 text-primary font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                        </svg>
                        Sign in with X.com
                    </button>

                    <div className="mt-6 pt-6 border-t border-gray-700">
                        <p className="text-sm text-gray-400 text-center">
                            By signing in, you agree to our Terms of Service and Privacy Policy
                        </p>
                    </div>
                </div>

                <div className="mt-8 grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-accent">💰</p>
                        <p className="text-sm text-gray-400 mt-2">Virtual Currency</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-accent">🎯</p>
                        <p className="text-sm text-gray-400 mt-2">Predict Events</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-accent">🏆</p>
                        <p className="text-sm text-gray-400 mt-2">Win Rewards</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
