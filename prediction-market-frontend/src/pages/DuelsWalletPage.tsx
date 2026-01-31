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
        return 'text-pump-yellow';
      case 'PAYOUT':
        return 'text-pump-green';
      case 'TRANSFER':
        return 'text-pump-red';
      default:
        return 'text-pump-gray';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-pump-green text-pump-black';
      case 'PENDING':
        return 'bg-pump-yellow text-pump-black';
      case 'FAILED':
        return 'bg-pump-red text-pump-white';
      default:
        return 'bg-pump-gray-dark text-pump-gray-light';
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
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="text-pump-gray-light hover:text-pump-green font-sans transition-colors duration-200"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-mono font-bold text-pump-white">Duels Wallet</h1>
      </div>

      {/* Wallet Connection */}
      <div className="mb-8">
        <WalletConnect />
      </div>

      {/* How It Works */}
      <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6 mb-8">
        <h2 className="text-xl font-mono font-bold text-pump-white mb-4">How Duels Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4">
            <div className="text-2xl font-mono font-bold text-pump-green mb-2">1</div>
            <h3 className="font-sans font-bold text-pump-white mb-1">Connect Wallet</h3>
            <p className="text-sm text-pump-gray-light font-sans">
              Connect your Solana wallet with $PREDICT tokens
            </p>
          </div>
          <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4">
            <div className="text-2xl font-mono font-bold text-pump-green mb-2">2</div>
            <h3 className="font-sans font-bold text-pump-white mb-1">Place Bet</h3>
            <p className="text-sm text-pump-gray-light font-sans">
              Tokens are locked in escrow when you enter a duel
            </p>
          </div>
          <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4">
            <div className="text-2xl font-mono font-bold text-pump-green mb-2">3</div>
            <h3 className="font-sans font-bold text-pump-white mb-1">Win or Lose</h3>
            <p className="text-sm text-pump-gray-light font-sans">
              Winner receives both stakes from escrow
            </p>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg">
        <div className="p-5 border-b-2 border-pump-gray-dark">
          <h2 className="text-xl font-mono font-bold text-pump-white">Escrow Transaction History</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow mx-auto"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-pump-gray font-sans">
            <p>No escrow transactions yet</p>
            <p className="text-sm mt-2">Start a duel to see your transactions here</p>
          </div>
        ) : (
          <div className="divide-y-2 divide-pump-gray-dark">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4 hover:bg-pump-black/50 transition-colors duration-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className={`font-mono font-semibold ${getTransactionTypeColor(tx.transaction_type)}`}>
                      {tx.transaction_type}
                    </span>
                    <span className="text-pump-gray font-sans ml-2">Duel #{tx.duel_id}</span>
                  </div>
                  <span className={`text-sm font-sans font-semibold px-2 py-1 rounded ${getStatusColor(tx.status)}`}>
                    {tx.status}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-2xl font-mono font-bold text-pump-white">
                      {formatAmount(tx.amount, tx.transaction_type)} {tx.token_symbol}
                    </p>
                    {tx.transaction_hash && (
                      <a
                        href={`https://explorer.solana.com/tx/${tx.transaction_hash}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono text-pump-green hover:text-pump-lime hover:underline transition-colors duration-200"
                      >
                        {shortenHash(tx.transaction_hash)}
                      </a>
                    )}
                  </div>
                  <div className="text-right text-sm text-pump-gray font-sans">
                    <p>{new Date(tx.created_at).toLocaleDateString()}</p>
                    <p>{new Date(tx.created_at).toLocaleTimeString()}</p>
                    {tx.confirmations > 0 && (
                      <p className="text-pump-green font-mono">{tx.confirmations} confirmations</p>
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
