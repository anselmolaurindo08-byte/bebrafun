import { useUserStore } from '../store/userStore';
import { useNavigate, Link } from 'react-router-dom';
import apiService from '../services/api';

export default function Header() {
    const { user, logout } = useUserStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await apiService.logout();
        logout();
        navigate('/login');
    };

    if (!user) return null;

    return (
        <header className="bg-secondary border-b border-gray-700 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                {/* Left side */}
                <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-accent">📊</div>
                    <div>
                        <h1 className="text-xl font-bold">Prediction Market</h1>
                        <p className="text-sm text-gray-400">Season 0</p>
                    </div>
                </div>

                {/* Center - Navigation */}
                <div className="flex items-center gap-6">
                    <Link to="/markets" className="text-lg font-semibold hover:text-accent transition-colors">
                        Markets
                    </Link>
                    <Link to="/duels" className="text-lg font-semibold hover:text-accent transition-colors">
                        Duels
                    </Link>
                    <p className="text-lg font-semibold text-accent">$PREDICT</p>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm text-gray-400">Balance</p>
                        <p className="text-lg font-bold text-accent">
                            ${Number(user.virtual_balance).toFixed(2)}
                        </p>
                    </div>

                    <div className="relative group">
                        <button className="flex items-center gap-2 bg-secondary hover:bg-gray-600 px-4 py-2 rounded-lg">
                            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-primary font-bold">
                                {user.x_username.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm">@{user.x_username}</span>
                        </button>

                        {/* Dropdown menu */}
                        <div className="absolute right-0 mt-2 w-48 bg-secondary rounded-lg shadow-lg hidden group-hover:block">
                            <Link
                                to="/profile"
                                className="block px-4 py-2 text-sm hover:bg-gray-600 rounded-t-lg"
                            >
                                Profile
                            </Link>
                            <Link
                                to="/referrals"
                                className="block px-4 py-2 text-sm hover:bg-gray-600"
                            >
                                Referral System
                            </Link>
                            <Link
                                to="/duels/wallet"
                                className="block px-4 py-2 text-sm hover:bg-gray-600 text-yellow-400"
                            >
                                Duels Wallet
                            </Link>
                            <Link
                                to="/settings"
                                className="block px-4 py-2 text-sm hover:bg-gray-600"
                            >
                                Settings
                            </Link>
                            <Link
                                to="/admin"
                                className="block px-4 py-2 text-sm hover:bg-gray-600 text-purple-400"
                            >
                                Admin Panel
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-600 rounded-b-lg text-danger"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
