import { useState, useEffect } from 'react';
import apiService from '../services/api';

interface WalletData {
  wallet_connected: boolean;
  wallet_address?: string;
  wallet_balance: string;
  escrow_balance: string;
  available_balance: string;
  token_symbol: string;
  last_updated?: string;
}

export default function WalletConnect() {
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const data = await apiService.getWalletBalances();
      setWalletData(data);
    } catch (err) {
      console.error('Failed to fetch wallet data:', err);
    }
  };

  const handleConnect = async () => {
    if (!walletAddress.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService.connectWallet({ wallet_address: walletAddress.trim() });
      await fetchWalletData();
      setWalletAddress('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your wallet?')) return;

    setLoading(true);
    try {
      await apiService.disconnectWallet();
      setWalletData(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to disconnect wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiService.refreshWalletBalance();
      await fetchWalletData();
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  const shortenAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-secondary rounded-lg p-6 border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Wallet Connection</h2>
        {walletData?.wallet_connected && (
          <span className="text-xs bg-green-600 px-2 py-1 rounded">Connected</span>
        )}
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {walletData?.wallet_connected ? (
        <div className="space-y-4">
          {/* Wallet Address */}
          <div className="bg-primary rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Wallet Address</p>
            <div className="flex items-center justify-between">
              <p className="font-mono text-accent">{shortenAddress(walletData.wallet_address || '')}</p>
              <button
                onClick={() => navigator.clipboard.writeText(walletData.wallet_address || '')}
                className="text-gray-400 hover:text-white text-sm"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Balances */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-primary rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Wallet Balance</p>
              <p className="text-2xl font-bold text-white">
                {formatBalance(walletData.wallet_balance)}
              </p>
              <p className="text-xs text-gray-500">{walletData.token_symbol}</p>
            </div>
            <div className="bg-primary rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">In Escrow</p>
              <p className="text-2xl font-bold text-yellow-400">
                {formatBalance(walletData.escrow_balance)}
              </p>
              <p className="text-xs text-gray-500">Locked in duels</p>
            </div>
            <div className="bg-primary rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Available</p>
              <p className="text-2xl font-bold text-accent">
                {formatBalance(walletData.available_balance)}
              </p>
              <p className="text-xs text-gray-500">For new duels</p>
            </div>
          </div>

          {/* Last Updated */}
          {walletData.last_updated && (
            <p className="text-xs text-gray-500 text-center">
              Last updated: {new Date(walletData.last_updated).toLocaleString()}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex-1 bg-accent hover:bg-green-500 text-primary font-bold py-2 px-4 rounded-lg disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh Balance'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 font-bold py-2 px-4 rounded-lg disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Connect your Solana wallet to participate in duels with $PREDICT tokens.
          </p>

          <div>
            <label className="block text-sm font-semibold mb-2">Wallet Address</label>
            <input
              type="text"
              placeholder="Enter your Solana wallet address"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="w-full bg-primary border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-accent"
            />
          </div>

          <button
            onClick={handleConnect}
            disabled={loading || !walletAddress.trim()}
            className="w-full bg-accent hover:bg-green-500 text-primary font-bold py-3 px-4 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>

          <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3">
            <p className="text-blue-400 text-sm">
              For testing, you can use any valid Solana devnet address.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
