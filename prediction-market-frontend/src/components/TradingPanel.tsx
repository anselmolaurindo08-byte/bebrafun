import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import apiService from '../services/api';

interface OrderBookLevel {
    price: string;
    quantity: string;
    orders: number;
}

interface OrderBook {
    bid_levels: OrderBookLevel[];
    ask_levels: OrderBookLevel[];
    mid_price: string;
    spread: string;
}

interface TradingPanelProps {
    marketId: number;
    eventId: number;
    eventTitle: string;
}

export default function TradingPanel({ marketId, eventId, eventTitle }: TradingPanelProps) {
    const { user } = useUserStore();
    const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
    const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchOrderBook();
        const interval = setInterval(fetchOrderBook, 2000); // Update every 2 seconds
        return () => clearInterval(interval);
    }, [marketId, eventId]);

    const fetchOrderBook = async () => {
        try {
            const response = await apiService.getOrderBook(marketId, eventId);
            setOrderBook(response);
        } catch (error) {
            console.error('Failed to fetch order book:', error);
        }
    };

    const handlePlaceOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await apiService.placeOrder({
                market_id: marketId,
                market_event_id: eventId,
                order_type: orderType,
                quantity,
                price,
            });

            alert('Order placed successfully!');
            setQuantity('');
            setPrice('');
            fetchOrderBook();
        } catch (error: any) {
            console.error('Failed to place order:', error);
            alert(error.response?.data?.error || 'Failed to place order');
        } finally {
            setLoading(false);
        }
    };

    const totalCost = (parseFloat(quantity || '0') * parseFloat(price || '0')).toFixed(2);

    return (
        <div className="bg-secondary rounded-lg p-6 border border-gray-700 mb-6">
            <h3 className="text-xl font-bold mb-4">{eventTitle}</h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Order Book */}
                <div className="lg:col-span-2">
                    <h4 className="text-lg font-semibold mb-3">Order Book</h4>

                    {orderBook ? (
                        <div className="space-y-4">
                            {/* Asks (Sell Orders) */}
                            <div>
                                <h5 className="text-sm font-semibold text-red-400 mb-2">Asks (Sell)</h5>
                                <div className="space-y-1">
                                    {(orderBook.ask_levels || []).slice(0, 5).reverse().map((level, idx) => (
                                        <div key={idx} className="flex justify-between text-sm bg-red-900 bg-opacity-10 p-2 rounded">
                                            <span className="text-red-400">${level.price}</span>
                                            <span className="text-gray-400">{level.quantity} shares</span>
                                        </div>
                                    ))}
                                    {(!orderBook.ask_levels || orderBook.ask_levels.length === 0) && (
                                        <p className="text-gray-500 text-sm">No asks yet</p>
                                    )}
                                </div>
                            </div>

                            {/* Mid Price */}
                            <div className="text-center py-3 border-t border-b border-gray-700">
                                <p className="text-2xl font-bold text-accent">${orderBook.mid_price || '0.00'}</p>
                                <p className="text-xs text-gray-400">Spread: ${orderBook.spread || '0.00'}</p>
                            </div>

                            {/* Bids (Buy Orders) */}
                            <div>
                                <h5 className="text-sm font-semibold text-green-400 mb-2">Bids (Buy)</h5>
                                <div className="space-y-1">
                                    {(orderBook.bid_levels || []).slice(0, 5).map((level, idx) => (
                                        <div key={idx} className="flex justify-between text-sm bg-green-900 bg-opacity-10 p-2 rounded">
                                            <span className="text-green-400">${level.price}</span>
                                            <span className="text-gray-400">{level.quantity} shares</span>
                                        </div>
                                    ))}
                                    {(!orderBook.bid_levels || orderBook.bid_levels.length === 0) && (
                                        <p className="text-gray-500 text-sm">No bids yet</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-400">Loading order book...</p>
                    )}
                </div>

                {/* Order Form */}
                <div>
                    <h4 className="text-lg font-semibold mb-3">Place Order</h4>

                    <form onSubmit={handlePlaceOrder} className="space-y-4">
                        {/* Order Type */}
                        <div>
                            <label className="block text-sm font-semibold mb-2">Type</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setOrderType('BUY')}
                                    className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${orderType === 'BUY'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-primary hover:bg-gray-700'
                                        }`}
                                >
                                    Buy
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOrderType('SELL')}
                                    className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${orderType === 'SELL'
                                            ? 'bg-red-600 text-white'
                                            : 'bg-primary hover:bg-gray-700'
                                        }`}
                                >
                                    Sell
                                </button>
                            </div>
                        </div>

                        {/* Quantity */}
                        <div>
                            <label className="block text-sm font-semibold mb-2">Quantity (shares)</label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="0"
                                step="1"
                                min="1"
                                required
                                className="w-full bg-primary border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-accent"
                            />
                        </div>

                        {/* Price */}
                        <div>
                            <label className="block text-sm font-semibold mb-2">Price (per share)</label>
                            <input
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                max="1"
                                required
                                className="w-full bg-primary border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-accent"
                            />
                        </div>

                        {/* Total */}
                        <div className="bg-primary rounded-lg p-3 border border-gray-700">
                            <p className="text-sm text-gray-400">Total Cost</p>
                            <p className="text-xl font-bold text-accent">${totalCost}</p>
                        </div>

                        {/* Balance Info */}
                        <div className="text-sm text-gray-400">
                            <p>Available: ${user?.virtual_balance?.toFixed(2) || '0.00'}</p>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full font-bold py-3 px-4 rounded-lg disabled:opacity-50 transition-colors ${orderType === 'BUY'
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-red-600 hover:bg-red-700 text-white'
                                }`}
                        >
                            {loading ? 'Placing Order...' : `Place ${orderType} Order`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
