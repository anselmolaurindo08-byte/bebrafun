import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { Duel } from '../../types/duel';
import { duelService } from '../../services/duelService';

interface DuelGameViewProps {
  duel: Duel;
  onResolved: () => void;
}

interface PriceData {
  time: number;
  price: number;
}

export const DuelGameView: React.FC<DuelGameViewProps> = ({ duel, onResolved }) => {
  const [data, setData] = useState<PriceData[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [startPrice, setStartPrice] = useState<number>(0);
  const [isResolving, setIsResolving] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const currencySymbol = duel.currency === 'SOL' ? 'SOLUSDT' : 'DOGEUSDT'; // Map PUMP/USDC to something volatile for demo or real

  useEffect(() => {
    // 1. Connect to Binance WebSocket
    // Using lowercase for stream name as per Binance API
    const symbol = currencySymbol.toLowerCase();
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@trade`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const price = parseFloat(message.p);
      const time = message.T;

      setCurrentPrice(price);

      // Capture start price on first tick if not set (or use duel.priceAtStart if backend provided it)
      setStartPrice((prev) => (prev === 0 ? price : prev));

      setData((prevData) => {
        const newData = [...prevData, { time, price }];
        // Keep last 60 seconds roughly
        if (newData.length > 60) return newData.slice(newData.length - 60);
        return newData;
      });
    };

    wsRef.current = ws;

    // 2. Countdown Timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleGameEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearInterval(timer);
    };
  }, []);

  const handleGameEnd = async () => {
    setIsResolving(true);
    // Determine winner locally for display (backend verifies)
    // If UP: current > start => Player 1 wins (if P1 picked UP)
    // Logic:
    // If prediction UP: P1 wins if End > Start
    // If prediction DOWN: P1 wins if End < Start
    // (Assuming P1 sets the prediction direction)

    // Auto-resolve via backend
    try {
        // Backend handles the actual logic, we just trigger "time's up"
        // Wait a bit for backend to process price feed or send manual trigger if needed
        // For MVP, we can trigger resolution from client if backend trusts price (not secure, but functional for demo)
        // Ideally backend has its own timer.

        // Simulating resolution delay
        setTimeout(async () => {
            // Reload page or callback to show result
            // onResolved(); // This reloads/navigates back

            // In a real app, we poll GET /api/duels/:id until status is RESOLVED
            await pollForResolution();
        }, 3000);
    } catch (e) {
        console.error(e);
    }
  };

  const pollForResolution = async () => {
      const interval = setInterval(async () => {
          try {
              const updatedDuel = await duelService.getDuel(duel.id);
              if (updatedDuel.status === 'RESOLVED') {
                  clearInterval(interval);
                  onResolved();
              }
          } catch(e) {
              console.error(e)
          }
      }, 2000);
  };

  // Calculate percentage change
  const percentChange = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;
  // const isWinning = (duel.predictedOutcome === 'UP' && percentChange > 0) || (duel.predictedOutcome === 'DOWN' && percentChange < 0);
  const color = percentChange >= 0 ? '#00FF41' : '#FF5252';

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 text-center">
          <p className="text-pump-gray font-sans text-xs mb-1">CURRENT PRICE</p>
          <p className="text-2xl font-mono font-bold" style={{ color }}>
            ${currentPrice.toFixed(4)}
          </p>
        </div>
        <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 text-center">
          <p className="text-pump-gray font-sans text-xs mb-1">TIME LEFT</p>
          <p className="text-2xl font-mono font-bold text-pump-white">
            {timeLeft}s
          </p>
        </div>
        <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 text-center">
          <p className="text-pump-gray font-sans text-xs mb-1">CHANGE</p>
          <p className="text-2xl font-mono font-bold" style={{ color }}>
            {percentChange > 0 ? '+' : ''}{percentChange.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full bg-pump-black border-2 border-pump-gray-dark rounded-lg p-2 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
              labelStyle={{ display: 'none' }}
              formatter={(value: any) => [`$${parseFloat(value).toFixed(4)}`, 'Price']}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={color}
              fillOpacity={1}
              fill="url(#colorPrice)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Start Line */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-50">
            {/* Can add reference line logic here if needed */}
        </div>
      </div>

      {/* Resolution Status */}
      {isResolving && (
        <div className="text-center animate-pulse">
          <p className="text-pump-yellow font-mono text-lg">CALCULATING RESULT...</p>
        </div>
      )}
    </div>
  );
};
