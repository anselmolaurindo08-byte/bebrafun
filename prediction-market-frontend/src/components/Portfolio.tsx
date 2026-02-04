import { useEffect, useState } from 'react';
import { useBlockchainWallet } from '../hooks/useBlockchainWallet';
import anchorProgramService from '../services/anchorProgramService';
import BN from 'bn.js';

interface PortfolioProps {
    marketId: number;
    userPosition: any | null;
}

export default function Portfolio({ marketId, userPosition }: PortfolioProps) {
    const { connected } = useBlockchainWallet();
    const [loading] = useState(false);

    // If not connected, show wallet prompt
    if (!connected) {
        return (
            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6">
                <h3 className="text-xl font-mono font-bold text-pump-white mb-4">Your Position</h3>
                <p className="text-pump-gray font-sans text-center py-8">Connect wallet to view your position</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6">
                <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow mx-auto"></div>
                    <p className="mt-3 text-pump-gray-light font-sans text-sm">Loading position...</p>
                </div>
            </div>
        );
    }

    // No position
    if (!userPosition || (userPosition.yes_tokens === 0 && userPosition.no_tokens === 0)) {
        return (
            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6">
                <h3 className="text-xl font-mono font-bold text-pump-white mb-4">Your Position</h3>
                <p className="text-pump-gray font-sans text-center py-8">No position yet. Buy some shares to get started!</p>
            </div>
        );
    }

    // Calculate values
    const yesTokens = userPosition.yes_tokens / 1_000_000_000;
    const noTokens = userPosition.no_tokens / 1_000_000_000;
    const totalInvested = (userPosition.total_invested || 0) / 1_000_000_000;

    return (
        <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6">
            <h3 className="text-xl font-mono font-bold text-pump-white mb-5">Your Position</h3>

            <div className="space-y-3">
                {/* YES Position */}
                {yesTokens > 0 && (
                    <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 flex justify-between items-center hover:border-pump-green transition-all duration-200">
                        <div>
                            <p className="font-mono font-semibold text-lg text-pump-green">YES</p>
                            <p className="text-sm text-pump-gray-light font-sans mt-1">
                                Shares: <span className="font-mono text-pump-white">{yesTokens.toFixed(4)}</span>
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-mono font-bold text-pump-green">
                                {yesTokens.toFixed(2)}
                            </p>
                            <p className="text-sm text-pump-gray-light font-sans mt-1">tokens</p>
                        </div>
                    </div>
                )}

                {/* NO Position */}
                {noTokens > 0 && (
                    <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 flex justify-between items-center hover:border-pump-red transition-all duration-200">
                        <div>
                            <p className="font-mono font-semibold text-lg text-pump-red">NO</p>
                            <p className="text-sm text-pump-gray-light font-sans mt-1">
                                Shares: <span className="font-mono text-pump-white">{noTokens.toFixed(4)}</span>
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-mono font-bold text-pump-red">
                                {noTokens.toFixed(2)}
                            </p>
                            <p className="text-sm text-pump-gray-light font-sans mt-1">tokens</p>
                        </div>
                    </div>
                )}

                {/* Total Invested */}
                {totalInvested > 0 && (
                    <div className="border-t-2 border-pump-gray-dark pt-4 mt-4">
                        <div className="flex justify-between items-center">
                            <p className="font-sans font-semibold text-lg text-pump-white">Total Invested</p>
                            <p className="text-2xl font-mono font-bold text-pump-white">
                                {totalInvested.toFixed(4)} SOL
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
