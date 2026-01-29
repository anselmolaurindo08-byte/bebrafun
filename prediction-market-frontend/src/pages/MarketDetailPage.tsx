import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiService from '../services/api';
import TradingPanel from '../components/TradingPanel';
import Portfolio from '../components/Portfolio';
import type { Market } from '../types/types';

export default function MarketDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [market, setMarket] = useState<Market | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMarket();
    }, [id]);

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

            {/* Trading Panels */}
            {market.events && market.events.length > 0 && (
                <div className="mt-8 space-y-6">
                    <h2 className="text-2xl font-mono font-bold text-pump-white">Trade Outcomes</h2>
                    {market.events.map((event) => (
                        <TradingPanel
                            key={event.id}
                            marketId={parseInt(id!)}
                            eventId={event.id}
                            eventTitle={event.event_title}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
