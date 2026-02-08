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
      return state;
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
        // Capture pre-trade reserves before executing trade
        const preTradeYesReserve = poolState.yesReserve;
        const preTradeNoReserve = poolState.noReserve;
        console.log('[Trade] Pre-trade reserves:', {
          yesReserve: preTradeYesReserve.toString(),
          noReserve: preTradeNoReserve.toString()
        });

        const result = await blockchainService.executeTrade(
          {
            poolId: poolState.poolId,
            inputAmount,
            tradeType,
            minOutputAmount: quote.minimumReceived,
            expectedOutputAmount: quote.outputAmount,
            feeAmount: quote.feeAmount,
            slippageTolerance,
            userWallet: publicKey,
          },
          publicKey,
          sendTransaction // Pass the sendTransaction function
        );

        setTxSignature(result.signature);
        setConfirmations(result.confirmations);

        if (result.status === 'confirmed') {
          // Fetch updated pool state and capture post-trade reserves directly
          // (can't use poolState - React state doesn't update within same callback)
          const updatedState = await fetchPoolState();
          const postTradeYesReserve = updatedState?.yesReserve ?? preTradeYesReserve;
          const postTradeNoReserve = updatedState?.noReserve ?? preTradeNoReserve;
          console.log('[Trade] Post-trade reserves:', {
            yesReserve: postTradeYesReserve.toString(),
            noReserve: postTradeNoReserve.toString()
          });

          // Record trade in backend for volume tracking and OHLC
          try {
            const { default: apiService } = await import('../services/api');
            console.log('[Trade] poolState.poolId RAW:', poolState.poolId, 'TYPE:', typeof poolState.poolId);
            const numericPoolId = parseInt(poolState.poolId, 10);
            console.log('[Trade] numericPoolId AFTER parseInt:', numericPoolId, 'TYPE:', typeof numericPoolId);

            const tradeData = {
              pool_id: numericPoolId,
              user_address: publicKey.toBase58(),
              trade_type: tradeType,
              input_amount: inputAmount.toNumber(),
              output_amount: quote.outputAmount.toNumber(),
              fee_amount: quote.feeAmount.toNumber(),
              transaction_signature: result.signature,
              // Send pre/post-trade reserves for OHLC calculation
              pre_trade_yes_reserve: preTradeYesReserve.toNumber(),
              pre_trade_no_reserve: preTradeNoReserve.toNumber(),
              post_trade_yes_reserve: postTradeYesReserve.toNumber(),
              post_trade_no_reserve: postTradeNoReserve.toNumber(),
              // Send base liquidity for accurate price calculation (from updatedState, not stale poolState!)
              base_yes_liquidity: updatedState?.baseYesLiquidity ?? poolState.baseYesLiquidity,
              base_no_liquidity: updatedState?.baseNoLiquidity ?? poolState.baseNoLiquidity,
            };
            console.log('[Trade] Base liquidity:', {
              baseYesLiquidity: tradeData.base_yes_liquidity,
              baseNoLiquidity: tradeData.base_no_liquidity
            });
            console.log('[Trade] Recording trade in backend:', tradeData);
            await apiService.recordTrade(tradeData);
            console.log('[Trade] Trade recorded successfully!');
          } catch (recordErr) {
            console.warn('[Trade] Failed to record trade in backend:', recordErr);
            // Don't fail the trade — on-chain is already confirmed
          }
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
