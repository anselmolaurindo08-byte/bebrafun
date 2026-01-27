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
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Markets</h1>
                <Link
                    to="/markets/propose"
                    className="bg-accent hover:bg-green-500 text-primary font-bold py-2 px-4 rounded-lg transition-colors"
                >
                    Propose Market
                </Link>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 mb-8 overflow-x-auto">
                {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${selectedCategory === cat
                                ? 'bg-accent text-primary'
                                : 'bg-secondary hover:bg-gray-600'
                            }`}
                    >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                ))}
            </div>

            {/* Markets Grid */}
            {loading ? (
                <div className="text-center py-8">Loading markets...</div>
            ) : markets.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No markets found</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {markets.map((market) => (
                        <Link
                            key={market.id}
                            to={`/markets/${market.id}`}
                            className="bg-secondary rounded-lg p-4 border border-gray-700 hover:border-accent transition-colors"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg flex-1">{market.title}</h3>
                                <span className="text-xs bg-accent text-primary px-2 py-1 rounded ml-2">
                                    {market.category}
                                </span>
                            </div>
                            <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                                {market.description}
                            </p>
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>{new Date(market.created_at).toLocaleDateString()}</span>
                                <span className="text-accent">→</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
