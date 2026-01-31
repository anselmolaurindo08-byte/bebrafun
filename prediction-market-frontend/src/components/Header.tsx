import { useState } from 'react';
import { useUserStore } from '../store/userStore';
import { useBlockchainWallet } from '../hooks/useBlockchainWallet';
import { useNavigate, Link } from 'react-router-dom';
import apiService from '../services/api';
import AuthModal from './AuthModal';

export default function Header() {
    const { user, token, logout } = useUserStore();
    const { balance } = useBlockchainWallet();
    const navigate = useNavigate();
    const [showAuthModal, setShowAuthModal] = useState(false);

    const isAuthenticated = !!token && !!user?.wallet_address;

    const handleLogout = async () => {
        await apiService.logout();
        logout();
        navigate('/');
    };

    return (
        <>
            <header className="bg-pump-black border-b-2 border-pump-gray-dark sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                    {/* Left side - Logo */}
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="text-2xl">📊</div>
                        <div>
                            <h1 className="text-xl font-mono font-bold text-pump-green"
                                style={{ textShadow: '0 0 10px rgba(0, 255, 65, 0.5)' }}>
                                PUMPSLY
                            </h1>
                            <p className="text-xs text-pump-gray-light font-sans">Season 0</p>
                        </div>
                    </Link>

                    {/* Center - Navigation */}
                    <nav className="flex items-center gap-8">
                        <Link
                            to="/markets"
                            className="text-sm font-sans font-medium text-pump-gray-light hover:text-pump-green transition-colors duration-200"
                        >
                            Markets
                        </Link>
                        <Link
                            to="/duels"
                            className="text-sm font-sans font-medium text-pump-gray-light hover:text-pump-green transition-colors duration-200"
                        >
                            Duels
                        </Link>
                        {isAuthenticated && (
                            <>
                                <Link
                                    to="/contests"
                                    className="text-sm font-sans font-medium text-pump-gray-light hover:text-pump-green transition-colors duration-200"
                                >
                                    Contests
                                </Link>
                                <Link
                                    to="/referrals"
                                    className="text-sm font-sans font-medium text-pump-gray-light hover:text-pump-green transition-colors duration-200"
                                >
                                    Referrals
                                </Link>
                            </>
                        )}
                    </nav>

                    {/* Right side - Auth State Dependent */}
                    <div className="flex items-center gap-4">
                        {isAuthenticated ? (
                            <>
                                {/* Balance */}
                                <div className="text-right px-4 py-2 bg-pump-gray-darker border-2 border-pump-gray-dark rounded-md">
                                    <p className="text-xs text-pump-gray-light font-sans">Balance</p>
                                    <p className="text-lg font-mono font-bold text-pump-green">
                                        {balance?.toFixed(4) || '0.0000'} SOL
                                    </p>
                                </div>

                                {/* User Dropdown */}
                                <div className="relative group">
                                    <button className="flex items-center gap-2 bg-pump-gray-darker border-2 border-pump-gray-dark hover:border-pump-green px-3 py-2 rounded-md transition-all duration-200">
                                        <div className="w-8 h-8 bg-pump-green rounded-full flex items-center justify-center text-pump-black font-bold text-sm">
                                            {user?.wallet_address?.substring(0, 2).toUpperCase()}
                                        </div>
                                        <span className="text-sm font-mono text-pump-white">
                                            {user?.wallet_address?.substring(0, 4)}...{user?.wallet_address?.substring(user.wallet_address.length - 4)}
                                        </span>
                                    </button>

                                    {/* Dropdown menu */}
                                    <div className="absolute right-0 mt-2 w-56 bg-pump-gray-darker border-2 border-pump-gray-dark rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                                        <Link
                                            to="/profile"
                                            className="block px-4 py-3 text-sm font-sans text-pump-white hover:bg-pump-gray-dark hover:text-pump-green rounded-t-md transition-colors"
                                        >
                                            Profile
                                        </Link>
                                        <Link
                                            to="/referrals"
                                            className="block px-4 py-3 text-sm font-sans text-pump-white hover:bg-pump-gray-dark hover:text-pump-green transition-colors"
                                        >
                                            Referral System
                                        </Link>
                                        <Link
                                            to="/duels/wallet"
                                            className="block px-4 py-3 text-sm font-sans text-pump-yellow hover:bg-pump-gray-dark transition-colors"
                                        >
                                            Duels Wallet
                                        </Link>
                                        <Link
                                            to="/settings"
                                            className="block px-4 py-3 text-sm font-sans text-pump-white hover:bg-pump-gray-dark hover:text-pump-green transition-colors"
                                        >
                                            Settings
                                        </Link>
                                        <Link
                                            to="/admin"
                                            className="block px-4 py-3 text-sm font-sans text-pump-cyan hover:bg-pump-gray-dark transition-colors"
                                        >
                                            Admin Panel
                                        </Link>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full text-left px-4 py-3 text-sm font-sans text-pump-red hover:bg-pump-gray-dark rounded-b-md transition-colors"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* Login Button for Unauthenticated Users */
                            <button
                                onClick={() => setShowAuthModal(true)}
                                className="bg-pump-green hover:bg-pump-lime text-pump-black font-bold py-2 px-6 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-glow font-sans text-sm"
                            >
                                Login
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Auth Modal */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
            />
        </>
    );
}
