import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { Duel } from '../../types/duel';
import { duelService } from '../../services/duelService';
import blockchainService from '../../services/blockchainService';

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
  // Initialize start price from duel.chartStartPrice if available, otherwise 0
  const [startPrice, setStartPrice] = useState<number>(duel.chartStartPrice || 0);
  const [isResolving, setIsResolving] = useState(false);
  const [isGameEnded, setIsGameEnded] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  // Map marketId to Binance streams
  // marketId: 1 = SOL/USDT, 2 = PUMP/USDT
  // currency is just the bet currency (always SOL)

  // DEBUG: Log duel object to see what we're working with
  console.log('[DuelGameView] Duel object:', {
    id: duel.id,
    marketId: duel.marketId,
    currency: duel.currency,
    betAmount: duel.betAmount
  });

  const currencySymbol = duel.marketId === 2 ? 'PUMPUSDT' : 'SOLUSDT';
  console.log('[DuelGameView] Selected chart:', currencySymbol, 'based on marketId:', duel.marketId);

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
        if (prev === 0) {
          // Save to backend for persistence
          duelService.setChartStartPrice(duel.id, price).catch(err =>
            console.error('Failed to save chart start price:', err)
          );
          return price;
        }
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

    // 2. Trigger auto-resolution with current price
    try {
      console.log('[DuelGameView] Triggering auto-resolution with exit price:', currentPrice);
      const result = await duelService.autoResolveDuel(duel.id, currentPrice);

      console.log('[DuelGameView] Resolution result:', result);

      setResult({
        winnerId: result.winner_id || result.winnerId || "0",
        finalPrice: result.exit_price || result.priceAtEnd || currentPrice,
        payout: result.payout || (duel.betAmount * 2)
      });
      setShowResultModal(true);
      setIsResolving(false);
    } catch (error) {
      console.error('[DuelGameView] Auto-resolution failed:', error);
      setIsResolving(false);
      // Fallback: poll for resolution
      const pollInterval = setInterval(async () => {
        try {
          const updatedDuel = await duelService.getDuel(duel.id);
          if (updatedDuel.status === 'RESOLVED' || updatedDuel.winnerId) {
            clearInterval(pollInterval);
            setResult({
              winnerId: updatedDuel.winnerId || "0",
              finalPrice: updatedDuel.priceAtEnd || currentPrice,
              payout: (updatedDuel.betAmount || duel.betAmount) * 2
            });
            setShowResultModal(true);
          }
        } catch (e) {
          console.error("Polling error:", e);
        }
      }, 2000);
    }
  };

  // Calculate percentage change for UI
  const percentChange = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;
  const color = percentChange >= 0 ? '#00FF41' : '#FF5252';

  // --- Handle Claim Winnings ---
  const handleClaimWinnings = async () => {
    setIsClaiming(true);
    try {
      // Step 1: Call smart contract - user signs to claim winnings
      // This will determine winner, update contract status, and send payout
      console.log('[DuelGameView] Calling smart contract claimWinnings for duelId:', duel.duelId, 'exitPrice:', duel.priceAtEnd);

      const result = await blockchainService.claimDuelWinnings(duel.duelId, duel.priceAtEnd || 0);

      if (!result.success) {
        throw new Error(result.error || 'Failed to claim winnings on-chain');
      }

      console.log('✅ Winnings claimed on-chain, payout tx:', result.tx);

      // Step 2: Update backend status after on-chain success
      await duelService.claimWinnings(duel.id);

      setClaimSuccess(true);
      // Success message will stay visible, no auto-redirect
    } catch (error) {
      console.error('[DuelGameView] Claim failed:', error);
      setIsClaiming(false);
      alert('Failed to claim winnings. Please try again.');
    }
  };

  // --- Render Result Modal ---
  const renderResultModal = () => {
    if (!showResultModal || !result) return null;


    // Get current user ID from localStorage (set during login)
    const currentUserId = localStorage.getItem('userId');

    const isP1Winner = String(result.winnerId) === String(duel.player1Id);

    // Check if current user is the winner by comparing user IDs
    const isWinner = String(result.winnerId) === String(currentUserId);

    // Debug logging
    console.log('[DuelGameView] Winner check:', {
      winnerId: result.winnerId,
      currentUserId,
      isWinner,
      player1Id: duel.player1Id,
      player2Id: duel.player2Id
    });

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
              <p className="font-mono font-bold text-pump-green">{(result.payout / 1e9).toFixed(4)} SOL</p>
            </div>
          </div>

          {claimSuccess ? (
            <div className="text-center">
              <p className="text-pump-green text-xl font-bold mb-4 animate-pulse">✓ WINNINGS CLAIMED!</p>
              <p className="text-pump-gray text-sm mb-4">Your winnings have been transferred to your wallet.</p>
              <button
                onClick={onResolved}
                className="w-full bg-pump-green hover:bg-green-400 text-black font-black font-mono py-3 px-6 rounded transition-transform hover:scale-105"
              >
                BACK TO DUELS
              </button>
            </div>
          ) : isWinner && duel.status === 'RESOLVED' ? (
            <button
              onClick={handleClaimWinnings}
              disabled={isClaiming}
              className="w-full bg-pump-green hover:bg-green-400 text-black font-black font-mono py-3 px-6 rounded transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClaiming ? 'CLAIMING...' : '💰 CLAIM WINNINGS'}
            </button>
          ) : isWinner && duel.status !== 'RESOLVED' ? (
            <div className="text-center">
              <p className="text-pump-gray text-sm mb-4">⏳ Waiting for duel to be resolved...</p>
              <p className="text-pump-gray text-xs">The system is processing the result. Please wait a moment.</p>
            </div>
          ) : (
            <button
              onClick={onResolved}
              className="w-full bg-pump-gray hover:bg-pump-gray-dark text-white font-black font-mono py-3 px-6 rounded transition-transform hover:scale-105"
            >
              CLOSE
            </button>
          )}
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
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
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
