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
        const interval = setInterval(fetchOrderBook, 2000);
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
        <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6 hover:border-pump-green transition-all duration-200">
            <h3 className="text-xl font-mono font-bold text-pump-white mb-6">{eventTitle}</h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Order Book */}
                <div className="lg:col-span-2">
                    <h4 className="text-lg font-sans font-semibold text-pump-white mb-4">Order Book</h4>

                    {orderBook ? (
                        <div className="space-y-4">
                            {/* Asks (Sell Orders) */}
                            <div>
                                <h5 className="text-xs font-sans font-semibold text-pump-red mb-2">ASKS (SELL)</h5>
                                <div className="space-y-1.5">
                                    {(orderBook.ask_levels || []).slice(0, 5).reverse().map((level, idx) => (
                                        <div key={idx} className="flex justify-between text-sm bg-pump-black p-3 rounded-md border border-pump-gray-dark">
                                            <span className="text-pump-red font-mono font-bold">${level.price}</span>
                                            <span className="text-pump-gray-light font-sans">{level.quantity} shares</span>
                                        </div>
                                    ))}
                                    {(!orderBook.ask_levels || orderBook.ask_levels.length === 0) && (
                                        <p className="text-pump-gray font-sans text-sm text-center py-4">No asks yet</p>
                                    )}
                                </div>
                            </div>

                            {/* Mid Price */}
                            <div className="text-center py-4 border-t-2 border-b-2 border-pump-gray-dark bg-pump-black rounded-md">
                                <p className="text-3xl font-mono font-bold text-pump-green">${orderBook.mid_price || '0.00'}</p>
                                <p className="text-xs text-pump-gray font-sans mt-1">Spread: ${orderBook.spread || '0.00'}</p>
                            </div>

                            {/* Bids (Buy Orders) */}
                            <div>
                                <h5 className="text-xs font-sans font-semibold text-pump-green mb-2">BIDS (BUY)</h5>
                                <div className="space-y-1.5">
                                    {(orderBook.bid_levels || []).slice(0, 5).map((level, idx) => (
                                        <div key={idx} className="flex justify-between text-sm bg-pump-black p-3 rounded-md border border-pump-gray-dark">
                                            <span className="text-pump-green font-mono font-bold">${level.price}</span>
                                            <span className="text-pump-gray-light font-sans">{level.quantity} shares</span>
                                        </div>
                                    ))}
                                    {(!orderBook.bid_levels || orderBook.bid_levels.length === 0) && (
                                        <p className="text-pump-gray font-sans text-sm text-center py-4">No bids yet</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="w-12 h-12 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow mx-auto"></div>
                            <p className="mt-4 text-pump-gray-light font-sans text-sm">Loading order book...</p>
                        </div>
                    )}
                </div>

                {/* Order Form */}
                <div>
                    <h4 className="text-lg font-sans font-semibold text-pump-white mb-4">Place Order</h4>

                    <form onSubmit={handlePlaceOrder} className="space-y-4">
                        {/* Order Type */}
                        <div>
                            <label className="block text-xs font-sans font-semibold text-pump-gray-light mb-2">TYPE</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setOrderType('BUY')}
                                    className={`flex-1 py-2.5 rounded-md font-sans font-semibold text-sm transition-all duration-200 ${orderType === 'BUY'
                                            ? 'bg-pump-green text-pump-black scale-105'
                                            : 'bg-pump-black text-pump-white border-2 border-pump-gray-dark hover:border-pump-green'
                                        }`}
                                >
                                    BUY
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOrderType('SELL')}
                                    className={`flex-1 py-2.5 rounded-md font-sans font-semibold text-sm transition-all duration-200 ${orderType === 'SELL'
                                            ? 'bg-pump-red text-pump-white scale-105'
                                            : 'bg-pump-black text-pump-white border-2 border-pump-gray-dark hover:border-pump-red'
                                        }`}
                                >
                                    SELL
                                </button>
                            </div>
                        </div>

                        {/* Quantity */}
                        <div>
                            <label className="block text-xs font-sans font-semibold text-pump-gray-light mb-2">QUANTITY (SHARES)</label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="0"
                                step="1"
                                min="1"
                                required
                                className="input-field w-full font-mono text-right"
                            />
                        </div>

                        {/* Price */}
                        <div>
                            <label className="block text-xs font-sans font-semibold text-pump-gray-light mb-2">PRICE (PER SHARE)</label>
                            <input
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                max="1"
                                required
                                className="input-field w-full font-mono text-right"
                            />
                        </div>

                        {/* Total */}
                        <div className="bg-pump-black rounded-md p-4 border-2 border-pump-gray-dark">
                            <p className="text-xs text-pump-gray-light font-sans mb-1">TOTAL COST</p>
                            <p className="text-2xl font-mono font-bold text-pump-green">${totalCost}</p>
                        </div>

                        {/* Balance Info */}
                        <div className="text-xs text-pump-gray font-sans">
                            <p>Available: <span className="text-pump-white font-mono">${user?.virtual_balance?.toFixed(2) || '0.00'}</span></p>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full font-sans font-semibold py-3 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${orderType === 'BUY'
                                    ? 'bg-pump-green hover:bg-pump-lime text-pump-black hover:scale-105 hover:shadow-glow'
                                    : 'bg-pump-red hover:bg-[#FF5252] text-pump-white hover:scale-105'
                                }`}
                        >
                            {loading ? 'PLACING ORDER...' : `PLACE ${orderType} ORDER`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
