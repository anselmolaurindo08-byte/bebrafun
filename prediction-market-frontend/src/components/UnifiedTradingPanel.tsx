import { useState, useEffect, useCallback } from 'react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import { useBlockchainTrade } from '../hooks/useBlockchainTrade';
import { useBlockchainWallet } from '../hooks/useBlockchainWallet';
import { TradeType } from '../services/types/blockchain';

interface UnifiedTradingPanelProps {
    poolId: string;
    pool: any;
    userPosition: any | null;
    eventTitle: string;
    onSuccess?: () => void;
}

export default function UnifiedTradingPanel({
    poolId,
    pool,
    userPosition,
    eventTitle,
    onSuccess,
}: UnifiedTradingPanelProps) {
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

    const [mode, setMode] = useState<'buy' | 'sell'>('buy');
    const [outcome, setOutcome] = useState<'yes' | 'no'>('yes');
    const [amount, setAmount] = useState('');

    // Fetch pool state on mount
    useEffect(() => {
        fetchPoolState();
        const interval = setInterval(fetchPoolState, 10000);
        return () => clearInterval(interval);
    }, [fetchPoolState]);

    // Calculate quote when inputs change
    useEffect(() => {
        const parsed = parseFloat(amount);
        if (!amount || isNaN(parsed) || parsed <= 0 || !poolState) {
            return;
        }
        // Both buy (SOL) and sell (shares) use same conversion to lamports
        const lamports = new BN(Math.floor(parsed * LAMPORTS_PER_SOL));
        const tradeType = mode === 'buy'
            ? (outcome === 'yes' ? TradeType.BUY_YES : TradeType.BUY_NO)
            : (outcome === 'yes' ? TradeType.SELL_YES : TradeType.SELL_NO);
        getQuote(lamports, tradeType);
    }, [amount, mode, outcome, poolState, getQuote]);

    const handleTrade = useCallback(async () => {
        const parsed = parseFloat(amount);
        if (!amount || isNaN(parsed) || parsed <= 0) return;

        let lamports: BN;
        if (mode === 'buy') {
            // For buy: amount is SOL, convert to lamports
            lamports = new BN(Math.floor(parsed * LAMPORTS_PER_SOL));
        } else {
            // For sell: amount is shares (already in lamports format on-chain)
            // User enters human-readable shares, we convert to lamports
            lamports = new BN(Math.floor(parsed * LAMPORTS_PER_SOL));
        }

        const tradeType = mode === 'buy'
            ? (outcome === 'yes' ? TradeType.BUY_YES : TradeType.BUY_NO)
            : (outcome === 'yes' ? TradeType.SELL_YES : TradeType.SELL_NO);

        const result = await executeTrade(lamports, tradeType);

        if (result && result.status === 'confirmed' && onSuccess) {
            onSuccess();
            setAmount(''); // Clear amount after successful trade
        }
    }, [amount, mode, outcome, executeTrade, onSuccess]);

    const formatSOL = (bn: BN): string => {
        return (bn.toNumber() / LAMPORTS_PER_SOL).toFixed(6);
    };

    // Helper to safely convert BN shares to human-readable number
    // Shares are stored in lamports, so we divide by LAMPORTS_PER_SOL
    const bnToNumber = (value: any): number => {
        if (!value) return 0;
        if (typeof value === 'number') return value / LAMPORTS_PER_SOL;
        if (value.toNumber) return value.toNumber() / LAMPORTS_PER_SOL;
        return 0;
    };

    const availableShares = mode === 'sell' && userPosition
        ? (outcome === 'yes' ? bnToNumber(userPosition.yesTokens) : bnToNumber(userPosition.noTokens))
        : 0;

    const canSell = mode === 'sell' && availableShares > 0;

    return (
        <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6">
            <h3 className="text-xl font-mono font-bold text-pump-white mb-6">
                {eventTitle}
            </h3>

            {/* Buy/Sell Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setMode('buy')}
                    className={`flex-1 py-2.5 rounded-md font-sans font-semibold text-sm transition-all ${mode === 'buy'
                        ? 'bg-pump-green text-pump-black'
                        : 'bg-pump-black text-pump-white border-2 border-pump-gray-dark'
                        }`}
                >
                    Buy
                </button>
                <button
                    onClick={() => setMode('sell')}
                    className={`flex-1 py-2.5 rounded-md font-sans font-semibold text-sm transition-all ${mode === 'sell'
                        ? 'bg-pump-red text-pump-white'
                        : 'bg-pump-black text-pump-white border-2 border-pump-gray-dark'
                        }`}
                >
                    Sell
                </button>
            </div>

            {/* Outcome Selection */}
            <div className="mb-4">
                <label className="block text-xs font-sans font-semibold text-pump-gray-light mb-2">
                    OUTCOME
                </label>
                <div className="flex gap-2">
                    <button
                        onClick={() => setOutcome('yes')}
                        className={`flex-1 py-2.5 rounded-md font-sans font-semibold text-sm transition-all ${outcome === 'yes'
                            ? 'bg-pump-green text-pump-black scale-105'
                            : 'bg-pump-black text-pump-white border-2 border-pump-gray-dark'
                            }`}
                    >
                        YES {pool && `${(pool.yes_price * 100).toFixed(0)}¢`}
                    </button>
                    <button
                        onClick={() => setOutcome('no')}
                        className={`flex-1 py-2.5 rounded-md font-sans font-semibold text-sm transition-all ${outcome === 'no'
                            ? 'bg-pump-red text-pump-white scale-105'
                            : 'bg-pump-black text-pump-white border-2 border-pump-gray-dark'
                            }`}
                    >
                        NO {pool && `${(pool.no_price * 100).toFixed(0)}¢`}
                    </button>
                </div>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
                <label className="block text-xs font-sans font-semibold text-pump-gray-light mb-2">
                    {mode === 'buy' ? 'AMOUNT (SOL)' : 'SHARES TO SELL'}
                </label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    max={mode === 'sell' ? availableShares : undefined}
                    className="input-field w-full font-mono text-right"
                    disabled={mode === 'sell' && !canSell}
                />
                {mode === 'sell' && (
                    <p className="text-xs text-pump-gray-light font-sans mt-1">
                        Available: {(availableShares || 0).toFixed(6)} shares
                    </p>
                )}
            </div>

            {/* Current Position */}
            {userPosition && (bnToNumber(userPosition.yesTokens) > 0 || bnToNumber(userPosition.noTokens) > 0) && (
                <div className="bg-pump-black rounded-md p-3 mb-4">
                    <p className="text-xs text-pump-gray-light font-sans mb-2">Your Position</p>
                    {bnToNumber(userPosition.yesTokens) > 0 && (
                        <p className="text-sm font-mono text-pump-green">
                            {bnToNumber(userPosition.yesTokens).toFixed(6)} YES shares
                        </p>
                    )}
                    {bnToNumber(userPosition.noTokens) > 0 && (
                        <p className="text-sm font-mono text-pump-red">
                            {bnToNumber(userPosition.noTokens).toFixed(6)} NO shares
                        </p>
                    )}
                </div>
            )}

            {/* Quote Display */}
            {quote && (
                <div className="bg-pump-black rounded-md p-4 border-2 border-pump-gray-dark mb-4">
                    <div className="flex justify-between mb-2">
                        <span className="text-xs text-pump-gray-light font-sans">
                            {mode === 'buy' ? 'You receive' : 'You get'}
                        </span>
                        <span className="text-sm font-mono font-bold text-pump-green">
                            {mode === 'buy'
                                ? `${(quote.outputAmount.toNumber() / LAMPORTS_PER_SOL * 1000).toFixed(0)} shares`
                                : `${(quote.outputAmount.toNumber() / LAMPORTS_PER_SOL).toFixed(6)} SOL`
                            }
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-xs text-pump-gray-light font-sans">Fee</span>
                        <span className="text-sm font-mono text-pump-white">
                            {formatSOL(quote.feeAmount)} SOL
                        </span>
                    </div>
                </div>
            )}

            {/* Balance */}
            {connected && (
                <div className="text-xs text-pump-gray font-sans mb-4">
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
                <div className="bg-pump-black border-2 border-pump-red rounded-md p-3 mb-4">
                    <p className="text-pump-red text-sm font-sans">{error.message}</p>
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
                <div className="bg-pump-black border-2 border-pump-green rounded-md p-3 mb-4">
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
                    !poolState ||
                    (mode === 'sell' && !canSell)
                }
                className={`w-full font-sans font-semibold py-3 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${mode === 'buy'
                    ? 'bg-pump-green hover:bg-pump-lime text-pump-black hover:scale-105 hover:shadow-glow'
                    : 'bg-pump-red hover:bg-[#FF5252] text-pump-white hover:scale-105'
                    }`}
            >
                {loading
                    ? 'PROCESSING...'
                    : !connected
                        ? 'CONNECT WALLET'
                        : mode === 'sell' && !canSell
                            ? 'NO SHARES TO SELL'
                            : `${mode.toUpperCase()} ${outcome.toUpperCase()}`}
            </button>
        </div>
    );
}
