import { useEffect, useState } from 'react';
import { useUserStore } from '../store/userStore';
import apiService from '../services/api';

export default function ProfilePage() {
    const { user, setUser } = useUserStore();
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
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-xl">Loading...</div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-xl">No user data</div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">User Profile</h1>

            <div className="bg-secondary rounded-xl p-6 border border-gray-700 mb-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center text-primary text-2xl font-bold">
                        {user.x_username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">@{user.x_username}</h2>
                        <p className="text-gray-400">X.com ID: {user.x_id}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-primary rounded-lg p-4">
                        <p className="text-gray-400 text-sm mb-1">Virtual Balance</p>
                        <p className="text-2xl font-bold text-accent">${user.virtual_balance.toFixed(2)}</p>
                    </div>
                    <div className="bg-primary rounded-lg p-4">
                        <p className="text-gray-400 text-sm mb-1">X.com Followers</p>
                        <p className="text-2xl font-bold text-accent">{user.followers_count.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="bg-secondary rounded-xl p-6 border border-gray-700">
                <h3 className="text-xl font-bold mb-4">Account Information</h3>
                <div className="space-y-4">
                    <div>
                        <p className="text-gray-400 text-sm">User ID</p>
                        <p className="text-white">{user.id}</p>
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">Member Since</p>
                        <p className="text-white">{new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                    {user.referrer_id && (
                        <div>
                            <p className="text-gray-400 text-sm">Referred By</p>
                            <p className="text-white">User ID: {user.referrer_id}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
