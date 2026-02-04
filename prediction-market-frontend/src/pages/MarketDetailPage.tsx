import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiService from '../services/api';
import blockchainService from '../services/blockchainService';
import anchorProgramService from '../services/anchorProgramService';
import AMMTradingPanel from '../components/AMMTradingPanel';
import Portfolio from '../components/Portfolio';
import SellOutcomeButton from '../components/SellOutcomeButton';
import AdminPoolControls from '../components/AdminPoolControls';
import type { Market, User } from '../types/types';
import { useBlockchainWallet } from '../hooks/useBlockchainWallet';
import BN from 'bn.js';

export default function MarketDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [market, setMarket] = useState<Market | null>(null);
    const [ammPoolId, setAmmPoolId] = useState<string | null>(null);
    const [pool, setPool] = useState<any>(null);
    const [userPosition, setUserPosition] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isCreatingPool, setIsCreatingPool] = useState(false);
    const { connected, publicKey } = useBlockchainWallet();

    useEffect(() => {
        fetchMarket();
        fetchAmmPool();
        fetchUser();
    }, [id]);

    const fetchUser = async () => {
        try {
            const user = await apiService.getProfile();
            setCurrentUser(user);

            // Check if user is admin
            try {
                await apiService.getAdminDashboard();
                setIsAdmin(true);
            } catch {
                setIsAdmin(false);
            }
        } catch {
            // User might not be logged in
        }
    };

    const handleCreatePool = async () => {
        if (!connected || !publicKey || !id || !market) return;

        setIsCreatingPool(true);
        try {
            // Default initial liquidity: 0.001 SOL (minimum for testing)
            const initialLiquidity = 0.001;
            const poolIdNum = parseInt(id);

            // Use market title as question
            const question = market.title;

            // Default resolution time: 30 days from now
            const resolutionTime = new Date();
            resolutionTime.setDate(resolutionTime.getDate() + 30);

            const result = await blockchainService.createPool(
                poolIdNum,
                question,
                resolutionTime,
                initialLiquidity
            );

            if (result.success) {
                setAmmPoolId(result.tx || '');
                console.log('✅ Pool created:', result.tx);
                console.log('Pool ID:', result.poolId);

                // Refresh pool data
                setTimeout(() => fetchAmmPool(), 2000);
            } else {
                throw new Error(result.error || 'Failed to create pool');
            }
        } catch (error: any) {
            console.error('Failed to create pool:', error);
            alert(`Failed to create pool: ${error.message || 'Unknown error'}`);
        } finally {
            setIsCreatingPool(false);
        }
    };

    const fetchMarket = async () => {
        try {
            const response = await apiService.getMarketById(id!);
            setMarket(response);
        } catch (error) {
            console.error('Failed to fetch market:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAmmPool = async () => {
        try {
            const poolData = await blockchainService.getPoolByMarketId(id!);
            setAmmPoolId(poolData.poolId);
            setPool(poolData);

            // Fetch user position if wallet connected
            if (connected && publicKey) {
                try {
                    const position = await anchorProgramService.getUserPosition(new BN(poolData.poolId), publicKey);
                    setUserPosition(position);
                } catch (err) {
                    console.log('No user position found');
                }
            }
        } catch (error) {
            // No AMM pool for this market
            console.error('Failed to fetch AMM pool:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen">
                <div className="w-16 h-16 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow"></div>
                <p className="mt-4 text-pump-gray-light font-sans">Loading market...</p>
            </div>
        );
    }

    if (!market) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-8 text-center">
                    <p className="text-pump-white font-mono text-xl mb-2">Market not found</p>
                    <p className="text-pump-gray font-sans text-sm">The market you're looking for doesn't exist</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Market Header */}
            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6 mb-6 hover:border-pump-green transition-all duration-200">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                        <h1 className="text-3xl font-mono font-bold text-pump-white mb-3 leading-tight">
                            {market.title}
                        </h1>
                        <p className="text-pump-gray-light font-sans text-base leading-relaxed">
                            {market.description}
                        </p>
                    </div>
                    <span className="bg-pump-green text-pump-black px-4 py-2 rounded-md font-sans font-semibold text-sm ml-6 whitespace-nowrap">
                        {market.category}
                    </span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t-2 border-pump-gray-dark">
                    <div className="bg-pump-black rounded-md p-4">
                        <p className="text-pump-gray-light font-sans text-xs mb-1">Status</p>
                        <p className="text-lg font-mono font-bold text-pump-green capitalize">{market.status}</p>
                    </div>
                    <div className="bg-pump-black rounded-md p-4">
                        <p className="text-pump-gray-light font-sans text-xs mb-1">Created</p>
                        <p className="text-lg font-mono font-bold text-pump-white">
                            {new Date(market.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Portfolio */}
            <Portfolio marketId={parseInt(id!)} />

            {/* Trading Section */}
            <div className="mt-8 space-y-6">
                <h2 className="text-2xl font-mono font-bold text-pump-white">Trade</h2>

                {ammPoolId ? (
                    <>
                        <AMMTradingPanel
                            poolId={ammPoolId}
                            eventTitle={market.title}
                        />

                        {/* Sell Outcome Tokens */}
                        {connected && pool && userPosition && (
                            <SellOutcomeButton
                                pool={pool}
                                userPosition={userPosition}
                                onSuccess={() => {
                                    fetchAmmPool();
                                }}
                            />
                        )}

                        {/* Admin Controls */}
                        {connected && pool && (
                            <AdminPoolControls
                                pool={pool}
                                onSuccess={() => {
                                    fetchAmmPool();
                                }}
                            />
                        )}
                    </>
                ) : (
                    <div className="bg-pump-gray-darker border-2 border-pump-yellow/30 rounded-lg p-8 text-center">
                        <div className="text-4xl mb-4">⚠️</div>
                        <h3 className="text-xl font-mono font-bold text-pump-white mb-2">No Liquidity Pool</h3>
                        <p className="text-pump-gray-light font-sans mb-6">
                            This market does not have an active AMM pool yet.
                            Liquidity must be added to enable trading.
                        </p>
                        {currentUser && market && (currentUser.id === market.created_by || isAdmin) && (
                            <div className="mt-4">
                                {!connected ? (
                                    <p className="text-pump-red font-sans text-sm">
                                        Please connect wallet to create pool
                                    </p>
                                ) : (
                                    <button
                                        onClick={handleCreatePool}
                                        disabled={isCreatingPool}
                                        className="bg-pump-green hover:bg-pump-lime text-pump-black font-sans font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isCreatingPool ? 'Creating Pool...' : 'Create Liquidity Pool (10 SOL)'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
