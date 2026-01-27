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
            <div className="bg-secondary rounded-lg p-6 border border-gray-700">
                <h3 className="text-xl font-bold mb-4">Your Portfolio</h3>
                <p className="text-gray-400 text-center py-8">Please login to view your portfolio</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-secondary rounded-lg p-6 border border-gray-700">
                <div className="text-center py-8">Loading portfolio...</div>
            </div>
        );
    }

    return (
        <div className="bg-secondary rounded-lg p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-4">Your Portfolio</h3>

            {positions.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No positions yet. Place an order to get started!</p>
            ) : (
                <div className="space-y-4">
                    {positions.map((position) => {
                        const qty = parseFloat(position.quantity || '0');
                        const avgPrice = parseFloat(position.average_price || '0');
                        const unrealizedPnl = parseFloat(position.unrealized_pnl || '0');

                        return (
                            <div
                                key={position.id}
                                className="bg-primary rounded-lg p-4 flex justify-between items-center border border-gray-700"
                            >
                                <div>
                                    <p className="font-semibold text-lg">{qty.toFixed(2)} shares</p>
                                    <p className="text-sm text-gray-400">
                                        Avg Price: ${avgPrice.toFixed(4)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Event ID: {position.market_event_id}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p
                                        className={`text-lg font-bold ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'
                                            }`}
                                    >
                                        {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
                                    </p>
                                    <p className="text-sm text-gray-400">Unrealized PnL</p>
                                </div>
                            </div>
                        );
                    })}

                    <div className="border-t border-gray-700 pt-4 mt-4">
                        <div className="flex justify-between items-center">
                            <p className="font-semibold text-lg">Total PnL</p>
                            <p
                                className={`text-2xl font-bold ${parseFloat(pnl) >= 0 ? 'text-green-400' : 'text-red-400'
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
