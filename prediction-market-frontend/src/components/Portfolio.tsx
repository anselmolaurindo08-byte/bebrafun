import { useEffect, useState } from 'react';
import { useUserStore } from '../store/userStore';
import apiService from '../services/api';

interface Position {
    id: number;
    market_event_id: number;
    quantity: string;
    average_price: string;
    unrealized_pnl: string;
}

interface PortfolioProps {
    marketId: number;
}

export default function Portfolio({ marketId }: PortfolioProps) {
    const { user: _user, isAuthenticated } = useUserStore();
    const [positions, setPositions] = useState<Position[]>([]);
    const [pnl, setPnl] = useState('0');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isAuthenticated) {
            fetchPortfolio();
        } else {
            setLoading(false);
        }
    }, [marketId, isAuthenticated]);

    const fetchPortfolio = async () => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [positionsData, pnlData] = await Promise.all([
                apiService.getUserPortfolio(marketId),
                apiService.getUserPnL(marketId),
            ]);

            setPositions(positionsData || []);
            setPnl(pnlData?.pnl || '0');
        } catch (error: any) {
            // Don't log 401 errors - expected when not authenticated
            if (error?.response?.status !== 401) {
                console.error('Failed to fetch portfolio:', error);
            }
        } finally {
            setLoading(false);
        }
    };

    // If not authenticated, show login prompt
    if (!isAuthenticated) {
        return (
            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6">
                <h3 className="text-xl font-mono font-bold text-pump-white mb-4">Your Portfolio</h3>
                <p className="text-pump-gray font-sans text-center py-8">Please login to view your portfolio</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6">
                <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow mx-auto"></div>
                    <p className="mt-3 text-pump-gray-light font-sans text-sm">Loading portfolio...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6">
            <h3 className="text-xl font-mono font-bold text-pump-white mb-5">Your Portfolio</h3>

            {positions.length === 0 ? (
                <p className="text-pump-gray font-sans text-center py-8">No positions yet. Place an order to get started!</p>
            ) : (
                <div className="space-y-3">
                    {positions.map((position) => {
                        const qty = parseFloat(position.quantity || '0');
                        const avgPrice = parseFloat(position.average_price || '0');
                        const unrealizedPnl = parseFloat(position.unrealized_pnl || '0');

                        return (
                            <div
                                key={position.id}
                                className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 flex justify-between items-center hover:border-pump-green transition-all duration-200"
                            >
                                <div>
                                    <p className="font-mono font-semibold text-lg text-pump-white">{qty.toFixed(2)} shares</p>
                                    <p className="text-sm text-pump-gray-light font-sans mt-1">
                                        Avg Price: <span className="font-mono">${avgPrice.toFixed(4)}</span>
                                    </p>
                                    <p className="text-xs text-pump-gray font-sans mt-1">
                                        Event ID: <span className="font-mono">{position.market_event_id}</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p
                                        className={`text-lg font-mono font-bold ${unrealizedPnl >= 0 ? 'text-pump-green' : 'text-pump-red'
                                            }`}
                                    >
                                        {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
                                    </p>
                                    <p className="text-sm text-pump-gray-light font-sans mt-1">Unrealized PnL</p>
                                </div>
                            </div>
                        );
                    })}

                    <div className="border-t-2 border-pump-gray-dark pt-4 mt-4">
                        <div className="flex justify-between items-center">
                            <p className="font-sans font-semibold text-lg text-pump-white">Total PnL</p>
                            <p
                                className={`text-2xl font-mono font-bold ${parseFloat(pnl) >= 0 ? 'text-pump-green' : 'text-pump-red'
                                    }`}
                            >
                                {parseFloat(pnl) >= 0 ? '+' : ''}${parseFloat(pnl).toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
