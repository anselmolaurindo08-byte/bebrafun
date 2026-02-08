import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import apiService from '../services/api';

interface PriceChartProps {
    pool: any | null;
}

interface ChartPoint {
    time: string;
    timestamp: number;
    yes: number;
    no: number;
}

export default function PriceChart({ pool }: PriceChartProps) {
    const [chartData, setChartData] = useState<ChartPoint[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch price history when pool changes
    useEffect(() => {
        if (!pool?.id) return;

        const fetchHistory = async () => {
            setLoading(true);
            try {
                const response = await apiService.getPriceHistory(pool.id);
                const candles = response?.candles || [];

                // Convert candles to chart points
                // Candles store YES probability as close price
                const points: ChartPoint[] = candles
                    .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                    .map((candle: any) => {
                        const ts = new Date(candle.timestamp);
                        const yesProb = parseFloat(candle.close) || 0.5;
                        return {
                            time: ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            timestamp: ts.getTime(),
                            yes: yesProb,
                            no: 1 - yesProb,
                        };
                    });

                // Add current live point at the end
                if (pool.yes_price !== undefined) {
                    const now = new Date();
                    points.push({
                        time: 'Now',
                        timestamp: now.getTime(),
                        yes: pool.yes_price,
                        no: pool.no_price,
                    });
                }

                // If no history, show at least 50/50 start + current
                if (points.length === 0 && pool.yes_price !== undefined) {
                    const created = pool.created_at ? new Date(pool.created_at) : new Date(Date.now() - 60000);
                    points.push({
                        time: created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        timestamp: created.getTime(),
                        yes: 0.5,
                        no: 0.5,
                    });
                    points.push({
                        time: 'Now',
                        timestamp: Date.now(),
                        yes: pool.yes_price,
                        no: pool.no_price,
                    });
                }

                setChartData(points);
            } catch (err) {
                console.error('[PriceChart] Failed to fetch price history:', err);
                // Fallback: just show current point
                if (pool?.yes_price !== undefined) {
                    setChartData([{
                        time: 'Now',
                        timestamp: Date.now(),
                        yes: pool.yes_price,
                        no: pool.no_price,
                    }]);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();

        // Refresh every 15 seconds
        const interval = setInterval(fetchHistory, 15000);
        return () => clearInterval(interval);
    }, [pool?.id, pool?.yes_price]);

    if (!pool) {
        return (
            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6 h-96 flex items-center justify-center">
                <p className="text-pump-gray-light font-sans">Loading chart...</p>
            </div>
        );
    }

    return (
        <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6">
            <h3 className="text-lg font-sans font-semibold text-pump-white mb-4">
                Price Chart
                {loading && <span className="text-xs text-pump-gray ml-2">(updating...)</span>}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="time" stroke="#888" fontSize={11} />
                    <YAxis stroke="#888" domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #2a2a2a',
                            borderRadius: '4px'
                        }}
                        formatter={(value: any, name: any) => [
                            `${(Number(value) * 100).toFixed(1)}%`,
                            String(name)
                        ]}
                    />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="yes"
                        stroke="#00ff88"
                        strokeWidth={2}
                        dot={chartData.length <= 10}
                        name="YES Price"
                    />
                    <Line
                        type="monotone"
                        dataKey="no"
                        stroke="#ff4444"
                        strokeWidth={2}
                        dot={chartData.length <= 10}
                        name="NO Price"
                    />
                </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="bg-pump-black rounded-md p-3">
                    <p className="text-xs text-pump-gray-light font-sans mb-1">YES Price</p>
                    <p className="text-2xl font-mono font-bold text-pump-green">
                        {(pool.yes_price * 100).toFixed(1)}¢
                    </p>
                </div>
                <div className="bg-pump-black rounded-md p-3">
                    <p className="text-xs text-pump-gray-light font-sans mb-1">NO Price</p>
                    <p className="text-2xl font-mono font-bold text-pump-red">
                        {(pool.no_price * 100).toFixed(1)}¢
                    </p>
                </div>
            </div>
        </div>
    );
}
