import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import blockchainService from '../services/blockchainService';
import type {
  UserAccount,
  BlockchainError,
} from '../services/types/blockchain';
import { BlockchainErrorType } from '../services/types/blockchain';

/**
 * Hook for managing unified wallet connection.
 * Used by both Duels and Prediction Markets (AMM).
 *
 * Bridges the React wallet adapter (@solana/wallet-adapter-react)
 * with the stateless BlockchainService singleton.
 */
export function useBlockchainWallet() {
  const {
    publicKey,
    connected,
    connecting,
    connect,
    disconnect,
    wallet,
  } = useWallet();

  const [account, setAccount] = useState<UserAccount | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BlockchainError | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Fetch balance and account data from chain
  const refreshBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(null);
      setAccount(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userAccount = await blockchainService.getUserAccount(publicKey);
      setAccount(userAccount);
      setBalance(userAccount.totalBalance);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch balance';
      setError(
        blockchainService.createError(
          BlockchainErrorType.NETWORK_ERROR,
          message,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  // Auto-refresh when wallet connects/disconnects
  useEffect(() => {
    if (connected && publicKey) {
      refreshBalance();
    } else {
      setAccount(null);
      setBalance(null);
    }
  }, [connected, publicKey, refreshBalance]);

  const connectWallet = useCallback(async () => {
    setError(null);
    try {
      await connect();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(
        blockchainService.createError(
          BlockchainErrorType.WALLET_NOT_CONNECTED,
          message,
        ),
      );
    }
  }, [connect]);

  const disconnectWallet = useCallback(async () => {
    setError(null);
    try {
      await disconnect();
      setAccount(null);
      setBalance(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to disconnect wallet';
      setError(
        blockchainService.createError(
          BlockchainErrorType.NETWORK_ERROR,
          message,
        ),
      );
    }
  }, [disconnect]);

  return {
    // Wallet state (from adapter)
    publicKey,
    connected,
    connecting,
    walletName: wallet?.adapter?.name,

    // Account data (from chain)
    account,
    balance,

    // Loading / error
    loading,
    error,

    // Actions
    connectWallet,
    disconnectWallet,
    refreshBalance,
    clearError,

    // Service access for advanced usage
    blockchainService,
  };
}
