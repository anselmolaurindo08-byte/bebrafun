import { useMemo, useCallback } from 'react';
import type { FC, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork, WalletError } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Import default styles for wallet modal
import '@solana/wallet-adapter-react-ui/styles.css';

interface Props {
  children: ReactNode;
}

export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  // Use Solana Devnet
  const network = WalletAdapterNetwork.Devnet;

  // RPC endpoint
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  // Wallet adapters - empty array lets Wallet Standard auto-detect installed wallets
  // Manual instantiation (PhantomWalletAdapter, etc.) conflicts with auto-detection
  const wallets = useMemo(() => [], []);

  // Only auto-connect if user has an active session (token in localStorage)
  // This prevents wallet from auto-reconnecting after logout
  const shouldAutoConnect = useMemo(() => !!localStorage.getItem('token'), []);

  const onError = useCallback((error: WalletError) => {
    console.error('[WalletProvider] Wallet error:', error.name, error.message);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={shouldAutoConnect} onError={onError}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
