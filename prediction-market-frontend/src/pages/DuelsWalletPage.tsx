import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import WalletConnect from '../components/WalletConnect';

interface EscrowTransaction {
  id: number;
  duel_id: number;
  transaction_type: string;
  amount: string;
  token_symbol: string;
  transaction_hash: string;
  status: string;
  confirmations: number;
  created_at: string;
  confirmed_at?: string;
}

export default function DuelsWalletPage() {
  const [transactions, setTransactions] = useState<EscrowTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const data = await apiService.getEscrowTransactions();
      setTransactions(data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return 'text-yellow-400';
      case 'PAYOUT':
        return 'text-green-400';
      case 'TRANSFER':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-600';
      case 'PENDING':
        return 'bg-yellow-600';
      case 'FAILED':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const formatAmount = (amount: string, type: string) => {
    const num = parseFloat(amount);
    const prefix = type === 'PAYOUT' ? '+' : type === 'TRANSFER' ? '-' : '';
    return `${prefix}${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  };

  const shortenHash = (hash: string) => {
    if (!hash) return '-';
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold">Duels Wallet</h1>
      </div>

      {/* Wallet Connection */}
      <div className="mb-8">
        <WalletConnect />
      </div>

      {/* How It Works */}
      <div className="bg-secondary rounded-lg p-6 border border-gray-700 mb-8">
        <h2 className="text-xl font-bold mb-4">How Duels Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-primary rounded-lg p-4">
            <div className="text-2xl mb-2">1</div>
            <h3 className="font-bold mb-1">Connect Wallet</h3>
            <p className="text-sm text-gray-400">
              Connect your Solana wallet with $PREDICT tokens
            </p>
          </div>
          <div className="bg-primary rounded-lg p-4">
            <div className="text-2xl mb-2">2</div>
            <h3 className="font-bold mb-1">Place Bet</h3>
            <p className="text-sm text-gray-400">
              Tokens are locked in escrow when you enter a duel
            </p>
          </div>
          <div className="bg-primary rounded-lg p-4">
            <div className="text-2xl mb-2">3</div>
            <h3 className="font-bold mb-1">Win or Lose</h3>
            <p className="text-sm text-gray-400">
              Winner receives both stakes from escrow
            </p>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-secondary rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Escrow Transaction History</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent mx-auto"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>No escrow transactions yet</p>
            <p className="text-sm mt-2">Start a duel to see your transactions here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4 hover:bg-gray-700/30">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className={`font-semibold ${getTransactionTypeColor(tx.transaction_type)}`}>
                      {tx.transaction_type}
                    </span>
                    <span className="text-gray-500 ml-2">Duel #{tx.duel_id}</span>
                  </div>
                  <span className={`text-sm px-2 py-1 rounded ${getStatusColor(tx.status)}`}>
                    {tx.status}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-2xl font-bold">
                      {formatAmount(tx.amount, tx.transaction_type)} {tx.token_symbol}
                    </p>
                    {tx.transaction_hash && (
                      <a
                        href={`https://explorer.solana.com/tx/${tx.transaction_hash}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-accent hover:underline"
                      >
                        {shortenHash(tx.transaction_hash)}
                      </a>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-400">
                    <p>{new Date(tx.created_at).toLocaleDateString()}</p>
                    <p>{new Date(tx.created_at).toLocaleTimeString()}</p>
                    {tx.confirmations > 0 && (
                      <p className="text-green-400">{tx.confirmations} confirmations</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
