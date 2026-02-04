import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface PriceChartProps {
    pool: any | null;
}

export default function PriceChart({ pool }: PriceChartProps) {
    // For now, show current price as static point
    // TODO: Fetch historical data from backend
    const data = pool ? [
        { time: 'Now', yes: pool.yes_price, no: pool.no_price }
    ] : [];

    if (!pool) {
        return (
            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6 h-96 flex items-center justify-center">
                <p className="text-pump-gray-light font-sans">Loading chart...</p>
            </div>
        );
    }

    return (
        <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6">
            <h3 className="text-lg font-sans font-semibold text-pump-white mb-4">Price Chart</h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="time" stroke="#888" />
                    <YAxis stroke="#888" domain={[0, 1]} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #2a2a2a',
                            borderRadius: '4px'
                        }}
                    />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="yes"
                        stroke="#00ff88"
                        strokeWidth={2}
                        name="YES Price"
                    />
                    <Line
                        type="monotone"
                        dataKey="no"
                        stroke="#ff4444"
                        strokeWidth={2}
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
