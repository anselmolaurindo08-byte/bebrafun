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
        return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
    }

    if (!market) {
        return <div className="flex justify-center items-center min-h-screen">Market not found</div>;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Market Header */}
            <div className="bg-secondary rounded-lg p-6 border border-gray-700 mb-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">{market.title}</h1>
                        <p className="text-gray-400">{market.description}</p>
                    </div>
                    <span className="bg-accent text-primary px-4 py-2 rounded-lg font-bold">
                        {market.category}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                    <div>
                        <p className="text-gray-400 text-sm">Status</p>
                        <p className="text-lg font-bold capitalize">{market.status}</p>
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">Created</p>
                        <p className="text-lg font-bold">{new Date(market.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            {/* Portfolio */}
            <Portfolio marketId={parseInt(id!)} />

            {/* Trading Panels for each outcome */}
            {market.events && market.events.length > 0 && (
                <div className="mt-6 space-y-6">
                    <h2 className="text-2xl font-bold">Trade Outcomes</h2>
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
