import { useState, useEffect, useCallback } from 'react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import { useBlockchainTrade } from '../hooks/useBlockchainTrade';
import { useBlockchainWallet } from '../hooks/useBlockchainWallet';
import { TradeType } from '../services/types/blockchain';

interface AMMTradingPanelProps {
  poolId: string;
  eventTitle: string;
  onSuccess?: () => void;
}

export default function AMMTradingPanel({
  poolId,
  eventTitle,
  onSuccess,
}: AMMTradingPanelProps) {
  const { connected, balance } = useBlockchainWallet();
  const {
    poolState,
    quote,
    loading,
    error,
    confirmations,
    txSignature,
    fetchPoolState,
    getQuote,
    executeTrade,
    clearError,
  } = useBlockchainTrade(poolId);

  const [tradeType, setTradeType] = useState<TradeType>(TradeType.BUY_YES);
  const [amount, setAmount] = useState('');

  // Fetch pool state on mount and poll every 10s
  useEffect(() => {
    fetchPoolState();
    const interval = setInterval(fetchPoolState, 10000);
    return () => clearInterval(interval);
  }, [fetchPoolState]);

  // Recalculate quote when inputs change
  useEffect(() => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0 || !poolState) {
      return;
    }
    const lamports = new BN(Math.floor(parsed * LAMPORTS_PER_SOL));
    getQuote(lamports, tradeType);
  }, [amount, tradeType, poolState, getQuote]);

  const handleTrade = useCallback(async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) return;
    const lamports = new BN(Math.floor(parsed * LAMPORTS_PER_SOL));
    const result = await executeTrade(lamports, tradeType);

    // Call onSuccess if trade was successful
    if (result && result.status === 'confirmed' && onSuccess) {
      onSuccess();
    }
  }, [amount, tradeType, executeTrade, onSuccess]);

  const formatSOL = (bn: BN): string => {
    return (bn.toNumber() / LAMPORTS_PER_SOL).toFixed(6);
  };

  return (
    <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6 hover:border-pump-green transition-all duration-200">
      <h3 className="text-xl font-mono font-bold text-pump-white mb-6">
        {eventTitle}
      </h3>

      {/* Trade Form - Full Width */}
      <div>
        <h4 className="text-lg font-sans font-semibold text-pump-white mb-4">
          Trade
        </h4>

        <div className="space-y-4">
          {/* Trade Type Selection */}
          <div>
            <label className="block text-xs font-sans font-semibold text-pump-gray-light mb-2">
              OUTCOME
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setTradeType(TradeType.BUY_YES)}
                className={`flex-1 py-2.5 rounded-md font-sans font-semibold text-sm transition-all duration-200 ${tradeType === TradeType.BUY_YES
                  ? 'bg-pump-green text-pump-black scale-105'
                  : 'bg-pump-black text-pump-white border-2 border-pump-gray-dark hover:border-pump-green'
                  }`}
              >
                BUY YES
              </button>
              <button
                onClick={() => setTradeType(TradeType.BUY_NO)}
                className={`flex-1 py-2.5 rounded-md font-sans font-semibold text-sm transition-all duration-200 ${tradeType === TradeType.BUY_NO
                  ? 'bg-pump-red text-pump-white scale-105'
                  : 'bg-pump-black text-pump-white border-2 border-pump-gray-dark hover:border-pump-red'
                  }`}
              >
                BUY NO
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-sans font-semibold text-pump-gray-light mb-2">
              AMOUNT (SOL)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="input-field w-full font-mono text-right"
            />
          </div>

          {/* Simplified Quote Display */}
          {quote && (
            <div className="bg-pump-black rounded-md p-4 border-2 border-pump-gray-dark space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-pump-gray-light font-sans">
                  You receive
                </span>
                <span className="text-sm font-mono font-bold text-pump-green">
                  {formatSOL(quote.outputAmount)} shares
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-pump-gray-light font-sans">
                  Fee
                </span>
                <span className="text-sm font-mono text-pump-white">
                  {formatSOL(quote.feeAmount)} SOL
                </span>
              </div>
            </div>
          )}

          {/* Balance Info */}
          {connected && (
            <div className="text-xs text-pump-gray font-sans">
              <p>
                Balance:{' '}
                <span className="text-pump-white font-mono">
                  {balance?.toFixed(4) || '0.0000'} SOL
                </span>
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-pump-black border-2 border-pump-red rounded-md p-3">
              <p className="text-pump-red text-sm font-sans">
                {error.message}
              </p>
              <button
                onClick={clearError}
                className="text-xs text-pump-gray-light font-sans mt-1 hover:text-pump-white"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Transaction Status */}
          {txSignature && (
            <div className="bg-pump-black border-2 border-pump-green rounded-md p-3">
              <p className="text-pump-green text-sm font-sans font-semibold mb-1">
                Transaction submitted
              </p>
              <p className="text-xs text-pump-gray-light font-mono break-all">
                {txSignature}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 bg-pump-gray-dark rounded-full h-2">
                  <div
                    className="bg-pump-green h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((confirmations / 6) * 100, 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-pump-white">
                  {confirmations}/6
                </span>
              </div>
            </div>
          )}

          {/* Trade Button */}
          <button
            onClick={handleTrade}
            disabled={
              loading ||
              !connected ||
              !amount ||
              isNaN(parseFloat(amount)) ||
              parseFloat(amount) <= 0 ||
              !poolState
            }
            className={`w-full font-sans font-semibold py-3 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${tradeType === TradeType.BUY_YES
              ? 'bg-pump-green hover:bg-pump-lime text-pump-black hover:scale-105 hover:shadow-glow'
              : 'bg-pump-red hover:bg-[#FF5252] text-pump-white hover:scale-105'
              }`}
          >
            {loading
              ? 'PROCESSING...'
              : !connected
                ? 'CONNECT WALLET'
                : `${tradeType === TradeType.BUY_YES ? 'BUY YES' : 'BUY NO'} SHARES`}
          </button>
        </div>
      </div>
    </div>
  );
}
