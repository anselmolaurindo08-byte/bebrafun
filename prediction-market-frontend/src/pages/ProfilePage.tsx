import { useEffect, useState } from 'react';
import { useUserStore } from '../store/userStore';
import { useBlockchainWallet } from '../hooks/useBlockchainWallet';
import apiService from '../services/api';

export default function ProfilePage() {
    const { user, setUser } = useUserStore();
    const { balance } = useBlockchainWallet();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const profile = await apiService.getProfile();
                setUser(profile);
            } catch (error) {
                console.error('Failed to fetch profile:', error);
            } finally {
                setLoading(false);
            }
        };

        if (!user) {
            fetchProfile();
        }
    }, [setUser, user]);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-pump-black">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow mx-auto mb-4"></div>
                    <div className="text-xl text-pump-gray-light font-sans">Loading...</div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-pump-black">
                <div className="text-xl text-pump-gray font-sans">No user data</div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-6 py-8">
            <h1 className="text-3xl font-mono font-bold text-pump-white mb-8">User Profile</h1>

            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6 mb-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-pump-green rounded-full flex items-center justify-center text-pump-black text-2xl font-mono font-bold">
                        {user.wallet_address.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-2xl font-mono font-bold text-pump-white">
                            {user.wallet_address.substring(0, 8)}...{user.wallet_address.substring(user.wallet_address.length - 6)}
                        </h2>
                        <p className="text-pump-gray font-sans">Wallet Address</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4">
                        <p className="text-pump-gray font-sans text-sm mb-1">SOL Balance</p>
                        <p className="text-2xl font-mono font-bold text-pump-green">{balance?.toFixed(4) || '0.0000'} SOL</p>
                    </div>
                    {user.x_username && (
                        <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4">
                            <p className="text-pump-gray font-sans text-sm mb-1">X.com Account</p>
                            <p className="text-lg font-mono font-bold text-pump-green">@{user.x_username}</p>
                            {user.followers_count !== undefined && (
                                <p className="text-xs text-pump-gray font-sans mt-1">{user.followers_count.toLocaleString()} followers</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6">
                <h3 className="text-xl font-mono font-bold text-pump-white mb-4">Account Information</h3>
                <div className="space-y-4">
                    <div>
                        <p className="text-pump-gray font-sans text-sm">User ID</p>
                        <p className="text-pump-white font-mono">{user.id}</p>
                    </div>
                    <div>
                        <p className="text-pump-gray font-sans text-sm">Member Since</p>
                        <p className="text-pump-white font-mono">{new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                    {user.referrer_id && (
                        <div>
                            <p className="text-pump-gray font-sans text-sm">Referred By</p>
                            <p className="text-pump-white font-mono">User ID: {user.referrer_id}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
