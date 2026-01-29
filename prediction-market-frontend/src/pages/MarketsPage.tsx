import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiService from '../services/api';
import type { Market } from '../types/types';

export default function MarketsPage() {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');

    const categories = ['all', 'Politics', 'Sports', 'Crypto'];

    useEffect(() => {
        fetchMarkets();
    }, [selectedCategory]);

    const fetchMarkets = async () => {
        setLoading(true);
        try {
            const category = selectedCategory === 'all' ? '' : selectedCategory;
            const response = await apiService.getMarkets(category);
            setMarkets(response);
        } catch (error) {
            console.error('Failed to fetch markets:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-mono font-bold text-pump-white">Markets</h1>
                <Link
                    to="/markets/propose"
                    className="bg-pump-green hover:bg-pump-lime text-pump-black font-semibold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-glow"
                >
                    + Propose Market
                </Link>
            </div>

            {/* Category Filter */}
            <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
                {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-6 py-2.5 rounded-md whitespace-nowrap font-sans font-medium text-sm transition-all duration-200 ${selectedCategory === cat
                                ? 'bg-pump-green text-pump-black'
                                : 'bg-pump-gray-darker text-pump-gray-light border-2 border-pump-gray-dark hover:border-pump-green hover:text-pump-green'
                            }`}
                    >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                ))}
            </div>

            {/* Markets Grid */}
            {loading ? (
                <div className="text-center py-16">
                    <div className="w-12 h-12 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow mx-auto"></div>
                    <p className="mt-4 text-pump-gray-light font-sans">Loading markets...</p>
                </div>
            ) : markets.length === 0 ? (
                <div className="text-center py-16 bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg">
                    <p className="text-pump-gray font-sans">No markets found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {markets.map((market) => (
                        <Link
                            key={market.id}
                            to={`/markets/${market.id}`}
                            className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-5 hover:border-pump-green hover:scale-[1.02] hover:shadow-glow transition-all duration-200"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="font-mono font-bold text-lg text-pump-white flex-1 leading-tight">
                                    {market.title}
                                </h3>
                                <span className="text-xs bg-pump-green text-pump-black px-2.5 py-1 rounded-full ml-3 font-sans font-semibold whitespace-nowrap">
                                    {market.category}
                                </span>
                            </div>

                            {/* Description */}
                            <p className="text-sm text-pump-gray-light font-sans mb-4 line-clamp-2 leading-relaxed">
                                {market.description}
                            </p>

                            {/* Footer */}
                            <div className="flex justify-between items-center text-xs text-pump-gray font-sans">
                                <span>{new Date(market.created_at).toLocaleDateString()}</span>
                                <span className="text-pump-green text-base">→</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
