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

interface GameResult {
  winnerId: string;
  finalPrice: number;
  payout: number;
}

export const DuelGameView: React.FC<DuelGameViewProps> = ({ duel, onResolved }) => {
  const [data, setData] = useState<PriceData[]>([]);

  // Calculate remaining time based on server start time
  const getInitialTimeLeft = () => {
    if (!duel.startedAt) return 60;
    const startTime = new Date(duel.startedAt).getTime();
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    return Math.max(0, 60 - elapsedSeconds);
  };

  const [timeLeft, setTimeLeft] = useState(getInitialTimeLeft());
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  // Initialize start price from duel if available, otherwise 0 until first tick
  const [startPrice, setStartPrice] = useState<number>(duel.priceAtStart || 0);
  const [isResolving, setIsResolving] = useState(false);
  const [isGameEnded, setIsGameEnded] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  // Map currencies to Binance streams
  const currencySymbol = duel.currency === 'SOL' ? 'SOLUSDT' : 'DOGEUSDT';

  // --- WebSocket & Timer Effect ---
  useEffect(() => {
    // If game already ended (e.g. strict mode re-mount), don't restart logic
    if (isGameEnded) return;

    // 1. Connect to Binance WebSocket
    const symbol = currencySymbol.toLowerCase();
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@trade`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const price = parseFloat(message.p);
      const time = message.T;

      setCurrentPrice(price);

      // Capture start price on first tick if not set
      setStartPrice((prev) => {
          if (prev === 0) return price;
          return prev;
      });

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
          // We call handleGameEnd immediately when time hits 0
          // but we need to reference the current state inside the closure or use a ref.
          // Since handleGameEnd depends on currentPrice, we should trigger it via effect or ref.
          // However, simpler is to let the effect detect 0.
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearInterval(timer);
    };
  }, [currencySymbol, isGameEnded]); // Dependency on isGameEnded to stop setup if ended

  // --- Watch for Timer == 0 ---
  useEffect(() => {
      if (timeLeft === 0 && !isGameEnded && currentPrice > 0) {
          handleGameEnd();
      }
  }, [timeLeft, isGameEnded, currentPrice]);


  const handleGameEnd = async () => {
    if (isGameEnded) return;
    setIsGameEnded(true);

    // 1. Freeze Chart (Close WS)
    if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
    }

    setIsResolving(true);

    // 2. Determine Winner locally
    const priceEnd = currentPrice;
    const priceStart = duel.priceAtStart || startPrice;

    // Logic:
    // P1 (Creator) predicts 'UP' or 'DOWN'.
    // If UP: P1 wins if End > Start.
    // If DOWN: P1 wins if End < Start.
    const isUpPrediction = duel.predictedOutcome === 'UP';
    const wentUp = priceEnd > priceStart;
    const wentDown = priceEnd < priceStart;

    let winnerId = "";

    // Check P1 win condition
    const p1Wins = (isUpPrediction && wentUp) || (!isUpPrediction && wentDown);

    if (p1Wins) {
        winnerId = String(duel.player1Id);
    } else {
        // If P1 didn't win, P2 wins (unless it's a perfect tie, then house or push? assume P2 for binary logic)
        // If P2 exists
        if (duel.player2Id) {
            winnerId = String(duel.player2Id);
        } else {
            // Should not happen in active duel
            winnerId = String(duel.player1Id); // Fallback
        }
    }

    // 3. Call Backend Resolution
    try {
        console.log(`Resolving Duel ${duel.id}. Winner: ${winnerId}, Start: ${priceStart}, End: ${priceEnd}`);

        // Ensure winnerId is a valid string representation of the ID
        const winnerIdStr = String(winnerId);
        if (!winnerIdStr || winnerIdStr === "undefined" || winnerIdStr === "0") {
             console.error("Invalid winner ID detected:", winnerId);
             throw new Error("Cannot resolve duel: Invalid winner ID");
        }

        await duelService.resolveDuelWithPrice(
            duel.id,
            winnerIdStr,
            priceEnd,
            "CLIENT_RESOLUTION_V1"
        );

        setResult({
            winnerId,
            finalPrice: priceEnd,
            payout: duel.betAmount * 2
        });
        setShowResultModal(true);

    } catch (e) {
        console.error("Resolution failed:", e);
        // Even if API fails, we show result locally? Or show error?
        // Show error for now, user might retry or refresh
        alert("Error resolving duel. Please check console.");
    } finally {
        setIsResolving(false);
    }
  };

  // Calculate percentage change for UI
  const percentChange = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;
  const color = percentChange >= 0 ? '#00FF41' : '#FF5252';

  // --- Render Result Modal ---
  const renderResultModal = () => {
      if (!showResultModal || !result) return null;

      const isP1Winner = String(result.winnerId) === String(duel.player1Id);
      // We don't know "Me" here easily without user store,
      // but we can display "Player 1 Wins" or "Player 2 Wins"
      // or use addresses/names if available in duel object.
      // Assuming duel has names (it usually does or we fetch them).
      // For now, generic text.

      const winnerName = isP1Winner ? "Player 1" : "Player 2";
      const isPositive = result.finalPrice >= (duel.priceAtStart || startPrice);
      const resultColor = isPositive ? 'text-pump-green' : 'text-pump-red';

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
            <div className="bg-pump-black border-2 border-pump-green rounded-xl p-8 max-w-md w-full text-center shadow-[0_0_30px_rgba(0,255,65,0.3)] transform animate-in fade-in zoom-in duration-300">
                <h2 className="text-3xl font-black font-mono text-white mb-2">DUEL ENDED</h2>

                <div className="my-6 space-y-2">
                    <p className="text-pump-gray text-sm">WINNER</p>
                    <div className="text-2xl font-bold text-pump-yellow animate-pulse">
                        {winnerName}
                    </div>
                    <div className="text-xs text-pump-gray font-mono">{result.winnerId}</div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-black/40 p-3 rounded border border-pump-gray-dark">
                        <p className="text-xs text-pump-gray">FINAL PRICE</p>
                        <p className={`font-mono font-bold ${resultColor}`}>${result.finalPrice.toFixed(4)}</p>
                    </div>
                    <div className="bg-black/40 p-3 rounded border border-pump-gray-dark">
                        <p className="text-xs text-pump-gray">PAYOUT</p>
                        <p className="font-mono font-bold text-pump-green">{result.payout} {duel.currency}</p>
                    </div>
                </div>

                <button
                    onClick={onResolved}
                    className="w-full bg-pump-green hover:bg-green-400 text-black font-black font-mono py-3 px-6 rounded transition-transform hover:scale-105"
                >
                    CLAIM & EXIT
                </button>
            </div>
        </div>
      );
  };

  return (
    <div className="space-y-6 relative">
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
            {Math.max(0, timeLeft)}s
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
      </div>

      {/* Resolution Status Loading Overlay */}
      {isResolving && !showResultModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 backdrop-blur-sm rounded-lg">
          <div className="text-center animate-pulse">
            <p className="text-pump-yellow font-mono text-xl font-bold">CALCULATING WINNER...</p>
            <p className="text-pump-gray text-sm mt-2">Verifying on-chain...</p>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {renderResultModal()}
    </div>
  );
};
