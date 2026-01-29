import { useEffect, useState } from 'react';
import { useUserStore } from '../store/userStore';
import apiService from '../services/api';

interface ReferralStats {
    total_referrals: number;
    active_referrals: number;
    total_rebates_earned: string;
    total_rebates_paid: string;
}

interface Rebate {
    id: number;
    rebate_percentage: string;
    rebate_amount: string;
    status: string;
    created_at: string;
}

interface ReferralCodeData {
    id: number;
    code: string;
    is_active: boolean;
}

export default function ReferralPage() {
    const { user } = useUserStore();
    const [referralCode, setReferralCode] = useState<ReferralCodeData | null>(null);
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [rebates, setRebates] = useState<Rebate[]>([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchReferralData();
    }, []);

    const fetchReferralData = async () => {
        setLoading(true);
        try {
            const [codeData, statsData, rebatesData] = await Promise.all([
                apiService.getReferralCode(),
                apiService.getReferralStats(),
                apiService.getReferralRebates(),
            ]);

            setReferralCode(codeData);
            setStats(statsData);
            setRebates(rebatesData);
        } catch (error) {
            console.error('Failed to fetch referral data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCode = () => {
        if (referralCode) {
            navigator.clipboard.writeText(referralCode.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleCopyLink = () => {
        if (referralCode) {
            navigator.clipboard.writeText(referralLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const referralLink = referralCode ? `${window.location.origin}?ref=${referralCode.code}` : '';

    // Calculate rebate tier based on followers
    const getRebateTier = () => {
        if (!user) return { tier: 'Not Eligible', percent: '0%' };
        const followers = user.followers_count || 0;
        if (followers >= 100000) return { tier: '100K+ Followers', percent: '50%' };
        if (followers >= 50000) return { tier: '50K+ Followers', percent: '40%' };
        if (followers >= 25000) return { tier: '25K+ Followers', percent: '30%' };
        if (followers >= 10000) return { tier: '10K+ Followers', percent: '25%' };
        if (followers >= 5000) return { tier: '5K+ Followers', percent: '20%' };
        if (followers >= 1000) return { tier: '1K+ Followers', percent: '15%' };
        return { tier: 'Under 1K Followers', percent: '0%' };
    };

    const tierInfo = getRebateTier();

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

    return (
        <div className="max-w-6xl mx-auto px-6 py-8">
            <h1 className="text-3xl font-mono font-bold text-pump-white mb-8">Referral Program</h1>

            {/* Referral Code Section */}
            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-mono font-bold text-pump-white mb-4">Your Referral Code</h2>

                <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 mb-4">
                    <p className="text-pump-gray font-sans text-sm mb-2">Share this code with friends</p>
                    <div className="flex items-center gap-2">
                        <code className="text-2xl font-mono font-bold text-pump-green flex-1">
                            {referralCode?.code || '---'}
                        </code>
                        <button
                            onClick={handleCopyCode}
                            className="bg-pump-green hover:bg-pump-lime text-pump-black font-sans font-semibold py-2 px-4 rounded-md transition-all duration-200 hover:scale-105"
                        >
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>

                <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4">
                    <p className="text-pump-gray font-sans text-sm mb-2">Or share this link</p>
                    <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-pump-gray-light flex-1 break-all">
                            {referralLink || '---'}
                        </code>
                        <button
                            onClick={handleCopyLink}
                            className="bg-pump-gray-dark hover:bg-pump-gray text-pump-white font-sans font-semibold py-2 px-4 rounded-md transition-colors duration-200"
                        >
                            Copy Link
                        </button>
                    </div>
                </div>
            </div>

            {/* Rebate Tier Section */}
            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-mono font-bold text-pump-white mb-4">Your Rebate Tier</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4">
                        <p className="text-pump-gray font-sans text-sm mb-1">X.com Followers</p>
                        <p className="text-2xl font-mono font-bold text-pump-green">
                            {(user?.followers_count || 0).toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4">
                        <p className="text-pump-gray font-sans text-sm mb-1">Your Tier</p>
                        <p className="text-xl font-sans font-bold text-pump-white">{tierInfo.tier}</p>
                    </div>
                    <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4">
                        <p className="text-pump-gray font-sans text-sm mb-1">Rebate Percentage</p>
                        <p className="text-2xl font-mono font-bold text-pump-green">{tierInfo.percent}</p>
                    </div>
                </div>

                <div className="p-4 bg-pump-green/10 rounded-lg border-2 border-pump-green/20">
                    <p className="text-sm text-pump-gray-light font-sans">
                        You earn a rebate on every trade made by users you refer. The rebate percentage
                        increases based on your X.com follower count. Grow your following to unlock higher tiers!
                    </p>
                </div>

                {/* Tier Table */}
                <div className="mt-4">
                    <h3 className="text-lg font-sans font-semibold text-pump-white mb-2">Rebate Tiers</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                        {[
                            { followers: '1K+', percent: '15%' },
                            { followers: '5K+', percent: '20%' },
                            { followers: '10K+', percent: '25%' },
                            { followers: '25K+', percent: '30%' },
                            { followers: '50K+', percent: '40%' },
                            { followers: '100K+', percent: '50%' },
                        ].map((tier) => (
                            <div
                                key={tier.followers}
                                className={`p-3 rounded-lg text-center ${tierInfo.percent === tier.percent
                                        ? 'bg-pump-green text-pump-black'
                                        : 'bg-pump-black border-2 border-pump-gray-dark'
                                    }`}
                            >
                                <p className="font-mono font-bold">{tier.percent}</p>
                                <p className="text-xs font-sans">{tier.followers}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Statistics Section */}
            {stats && (
                <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6 mb-6">
                    <h2 className="text-2xl font-mono font-bold text-pump-white mb-4">Your Statistics</h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4">
                            <p className="text-pump-gray font-sans text-sm mb-1">Total Referrals</p>
                            <p className="text-2xl font-mono font-bold text-pump-green">{stats.total_referrals}</p>
                        </div>
                        <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4">
                            <p className="text-pump-gray font-sans text-sm mb-1">Active Referrals</p>
                            <p className="text-2xl font-mono font-bold text-pump-green">{stats.active_referrals}</p>
                        </div>
                        <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4">
                            <p className="text-pump-gray font-sans text-sm mb-1">Rebates Earned</p>
                            <p className="text-2xl font-mono font-bold text-pump-green">
                                ${parseFloat(stats.total_rebates_earned || '0').toFixed(2)}
                            </p>
                        </div>
                        <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4">
                            <p className="text-pump-gray font-sans text-sm mb-1">Rebates Paid</p>
                            <p className="text-2xl font-mono font-bold text-pump-green">
                                ${parseFloat(stats.total_rebates_paid || '0').toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Rebates History */}
            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6">
                <h2 className="text-2xl font-mono font-bold text-pump-white mb-4">Rebate History</h2>

                {rebates.length === 0 ? (
                    <p className="text-pump-gray font-sans text-center py-8">
                        No rebates yet. Share your referral code to start earning!
                    </p>
                ) : (
                    <div className="space-y-3">
                        {rebates.map((rebate) => (
                            <div
                                key={rebate.id}
                                className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 flex justify-between items-center hover:border-pump-green transition-all duration-200"
                            >
                                <div>
                                    <p className="font-sans font-semibold text-pump-white">
                                        {parseFloat(rebate.rebate_percentage).toFixed(0)}% rebate
                                    </p>
                                    <p className="text-sm text-pump-gray font-sans">
                                        {new Date(rebate.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono font-bold text-pump-green">
                                        +${parseFloat(rebate.rebate_amount).toFixed(4)}
                                    </p>
                                    <p
                                        className={`text-sm font-sans ${rebate.status === 'PAID'
                                                ? 'text-pump-green'
                                                : 'text-pump-yellow'
                                            }`}
                                    >
                                        {rebate.status}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
