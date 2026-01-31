import { useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import BN from 'bn.js';
import blockchainService from '../services/blockchainService';
import type {
  PoolState,
  TradeQuote,
  TransactionResult,
  BlockchainError,
} from '../services/types/blockchain';
import { BlockchainErrorType } from '../services/types/blockchain';
import type { TradeType } from '../services/types/blockchain';

/**
 * Hook for AMM trading operations.
 *
 * Manages pool state fetching, quote calculation, and trade execution.
 * Works with the stateless BlockchainService singleton.
 */
export function useBlockchainTrade(poolId: string) {
  const { publicKey, sendTransaction } = useWallet();
  useConnection(); // Ensure connection context exists

  const [poolState, setPoolState] = useState<PoolState | null>(null);
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BlockchainError | null>(null);
  const [confirmations, setConfirmations] = useState(0);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchPoolState = useCallback(async () => {
    if (!poolId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await blockchainService.getPoolState(poolId);
      setPoolState(state);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch pool state';
      setError(
        blockchainService.createError(
          BlockchainErrorType.INVALID_POOL,
          message,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  const fetchPoolByMarket = useCallback(
    async (marketId: string) => {
      setLoading(true);
      setError(null);
      try {
        const state =
          await blockchainService.getPoolByMarketId(marketId);
        setPoolState(state);
        return state;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to fetch pool by market';
        setError(
          blockchainService.createError(
            BlockchainErrorType.INVALID_POOL,
            message,
          ),
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const getQuote = useCallback(
    (
      inputAmount: BN,
      tradeType: TradeType,
      slippageTolerance: number = 0.5,
    ): TradeQuote | null => {
      if (!poolState) {
        setQuote(null);
        return null;
      }
      try {
        const tradeQuote = blockchainService.calculateTradeQuote(
          poolState,
          inputAmount,
          tradeType,
          slippageTolerance,
        );
        setQuote(tradeQuote);
        return tradeQuote;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to calculate quote';
        setError(
          blockchainService.createError(
            BlockchainErrorType.INVALID_AMOUNT,
            message,
          ),
        );
        return null;
      }
    },
    [poolState],
  );

  const executeTrade = useCallback(
    async (
      inputAmount: BN,
      tradeType: TradeType,
      slippageTolerance: number = 0.5,
    ): Promise<TransactionResult | null> => {
      if (!publicKey) {
        setError(
          blockchainService.createError(
            BlockchainErrorType.WALLET_NOT_CONNECTED,
            'Wallet not connected',
          ),
        );
        return null;
      }
      if (!poolState || !quote) {
        setError(
          blockchainService.createError(
            BlockchainErrorType.INVALID_POOL,
            'Pool state or quote not available',
          ),
        );
        return null;
      }

      setLoading(true);
      setError(null);
      setConfirmations(0);
      setTxSignature(null);

      try {
        const result = await blockchainService.executeTrade(
          {
            poolId: poolState.poolId,
            inputAmount,
            tradeType,
            minOutputAmount: quote.minimumReceived,
            slippageTolerance,
            userWallet: publicKey,
          },
          publicKey,
          sendTransaction // Pass the sendTransaction function
        );

        setTxSignature(result.signature);
        setConfirmations(result.confirmations);

        if (result.status === 'confirmed') {
          await fetchPoolState();
        }

        return result;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Trade execution failed';
        setError(
          blockchainService.createError(
            BlockchainErrorType.TRANSACTION_FAILED,
            message,
          ),
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, poolState, quote, fetchPoolState, sendTransaction],
  );

  return {
    poolState,
    quote,
    loading,
    error,
    confirmations,
    txSignature,
    fetchPoolState,
    fetchPoolByMarket,
    getQuote,
    executeTrade,
    clearError,
  };
}
