import { useEffect, useState } from 'react';
import { useUserStore } from '../store/userStore';
import { useBlockchainWallet } from '../hooks/useBlockchainWallet';
import apiService from '../services/api';

interface VolumeStats {
    duel_volume_sol: number;
    market_volume_sol: number;
    total_volume_sol: number;
}

export default function ProfilePage() {
    const { user, setUser } = useUserStore();
    const { balance } = useBlockchainWallet();
    const [loading, setLoading] = useState(false);
    const [editingNickname, setEditingNickname] = useState(false);
    const [nickname, setNickname] = useState('');
    const [nicknameError, setNicknameError] = useState('');
    const [volume, setVolume] = useState<VolumeStats | null>(null);
    const [volumeLoading, setVolumeLoading] = useState(false);

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
        } else {
            setNickname(user.nickname || '');
        }
    }, [setUser, user]);

    // Fetch volume stats
    useEffect(() => {
        const fetchVolume = async () => {
            setVolumeLoading(true);
            try {
                const volumeData = await apiService.getUserVolume();
                setVolume(volumeData);
            } catch (error) {
                console.error('Failed to fetch volume:', error);
            } finally {
                setVolumeLoading(false);
            }
        };

        if (user) {
            fetchVolume();
        }
    }, [user]);

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

    const handleNicknameUpdate = async () => {
        if (!nickname || nickname.length < 3 || nickname.length > 50) {
            setNicknameError('Nickname must be between 3 and 50 characters');
            return;
        }

        try {
            setLoading(true);
            await apiService.updateNickname(nickname);
            // Refresh profile to get updated nickname
            const updatedProfile = await apiService.getProfile();
            setUser(updatedProfile);
            setEditingNickname(false);
            setNicknameError('');
        } catch (error: any) {
            setNicknameError(error.response?.data?.error || 'Failed to update nickname');
        } finally {
            setLoading(false);
        }
    };

    const formatVolume = (val: number) => {
        if (val >= 1000) return val.toFixed(2);
        if (val >= 1) return val.toFixed(4);
        return val.toFixed(6);
    };

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

                <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 mt-4">
                    <p className="text-pump-gray font-sans text-sm mb-2">Nickname</p>
                    {editingNickname ? (
                        <div>
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                className="w-full bg-pump-gray-darker border-2 border-pump-gray-dark rounded px-3 py-2 text-pump-white font-mono mb-2"
                                placeholder="Enter nickname"
                            />
                            {nicknameError && (
                                <p className="text-pump-red text-xs font-sans mb-2">{nicknameError}</p>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleNicknameUpdate}
                                    disabled={loading}
                                    className="bg-pump-green text-pump-black px-4 py-2 rounded font-sans font-semibold text-sm hover:bg-opacity-80 disabled:opacity-50"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingNickname(false);
                                        setNickname(user.nickname || '');
                                        setNicknameError('');
                                    }}
                                    className="bg-pump-gray-dark text-pump-white px-4 py-2 rounded font-sans font-semibold text-sm hover:bg-opacity-80"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <p className="text-lg font-mono font-bold text-pump-green">{user.nickname || 'No nickname'}</p>
                            <button
                                onClick={() => setEditingNickname(true)}
                                className="text-pump-green text-sm font-sans hover:underline"
                            >
                                Edit
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Volume Statistics */}
            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6 mb-6">
                <h3 className="text-xl font-mono font-bold text-pump-white mb-4">📊 Your Volume</h3>
                {volumeLoading ? (
                    <div className="flex justify-center py-4">
                        <div className="w-8 h-8 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow"></div>
                    </div>
                ) : volume ? (
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 text-center">
                            <p className="text-pump-gray font-sans text-xs mb-1">🎯 Duels</p>
                            <p className="text-xl font-mono font-bold text-pump-cyan">{formatVolume(volume.duel_volume_sol)}</p>
                            <p className="text-pump-gray font-sans text-xs">SOL</p>
                        </div>
                        <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 text-center">
                            <p className="text-pump-gray font-sans text-xs mb-1">📈 Markets</p>
                            <p className="text-xl font-mono font-bold text-pump-cyan">{formatVolume(volume.market_volume_sol)}</p>
                            <p className="text-pump-gray font-sans text-xs">SOL</p>
                        </div>
                        <div className="bg-pump-black border-2 border-pump-green rounded-lg p-4 text-center">
                            <p className="text-pump-gray font-sans text-xs mb-1">💰 Total</p>
                            <p className="text-xl font-mono font-bold text-pump-green">{formatVolume(volume.total_volume_sol)}</p>
                            <p className="text-pump-gray font-sans text-xs">SOL</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-pump-gray font-sans text-sm">Unable to load volume data</p>
                )}
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
