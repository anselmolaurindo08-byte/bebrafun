import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import blockchainService from '../services/blockchainService';
import './SellOutcomeButton.css';

interface SellOutcomeButtonProps {
    pool: any; // TODO: Add proper Pool type
    userPosition: any; // TODO: Add proper UserPosition type
    onSuccess?: () => void;
}

function SellOutcomeButton({ pool, userPosition, onSuccess }: SellOutcomeButtonProps) {
    const { publicKey } = useWallet();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSellYes = async () => {
        if (!publicKey || !userPosition?.yes_tokens) return;

        setLoading(true);
        setError(null);

        try {
            const result = await blockchainService.sellShares(
                pool.id,
                'yes',
                userPosition.yes_tokens
            );

            if (result.success) {
                console.log('✅ Sold YES shares:', result.tx);
                alert('Successfully sold YES shares!');

                if (onSuccess) {
                    onSuccess();
                }
            } else {
                throw new Error(result.error || 'Failed to sell YES shares');
            }
        } catch (err: any) {
            console.error('❌ Error selling YES tokens:', err);
            setError(err.message || 'Failed to sell YES tokens');
        } finally {
            setLoading(false);
        }
    };

    const handleSellNo = async () => {
        if (!publicKey || !userPosition?.no_tokens) return;

        setLoading(true);
        setError(null);

        try {
            const result = await blockchainService.sellShares(
                pool.id,
                'no',
                userPosition.no_tokens
            );

            if (result.success) {
                console.log('✅ Sold NO shares:', result.tx);
                alert('Successfully sold NO shares!');

                if (onSuccess) {
                    onSuccess();
                }
            } else {
                throw new Error(result.error || 'Failed to sell NO shares');
            }
        } catch (err: any) {
            console.error('❌ Error selling NO tokens:', err);
            setError(err.message || 'Failed to sell NO tokens');
        } finally {
            setLoading(false);
        }
    };

    if (!publicKey) {
        return <div className="sell-outcome-message">Connect wallet to sell tokens</div>;
    }

    if (!userPosition || (userPosition.yes_tokens === 0 && userPosition.no_tokens === 0)) {
        return <div className="sell-outcome-message">No tokens to sell</div>;
    }

    return (
        <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-6">
            <h3 className="text-xl font-mono font-bold text-pump-white mb-4">Sell Outcome Tokens</h3>

            {error && (
                <div className="bg-pump-red/10 border-2 border-pump-red rounded-md p-3 mb-4">
                    <p className="text-pump-red font-sans text-sm">{error}</p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                {/* Sell YES */}
                {userPosition?.yes_tokens > 0 && (
                    <div className="bg-pump-black rounded-md p-4">
                        <p className="text-pump-gray-light font-sans text-xs mb-2">YES Tokens</p>
                        <p className="text-2xl font-mono font-bold text-pump-green mb-3">
                            {(userPosition.yes_tokens / 1_000_000_000).toFixed(4)}
                        </p>
                        <button
                            onClick={handleSellYes}
                            disabled={loading}
                            className="sell-yes-btn"
                        >
                            {loading ? 'Selling...' : `Sell YES tokens`}
                        </button>
                    </div>
                )}

                {/* Sell NO */}
                {userPosition?.no_tokens > 0 && (
                    <div className="bg-pump-black rounded-md p-4">
                        <p className="text-pump-gray-light font-sans text-xs mb-2">NO Tokens</p>
                        <p className="text-2xl font-mono font-bold text-pump-red mb-3">
                            {(userPosition.no_tokens / 1_000_000_000).toFixed(4)}
                        </p>
                        <button
                            onClick={handleSellNo}
                            disabled={loading}
                            className="sell-no-btn"
                        >
                            {loading ? 'Selling...' : `Sell NO tokens`}
                        </button>
                    </div>
                )}
            </div>

            <p className="fee-notice">
                Fee: 0.3%
            </p>
        </div>
    );
}

export default SellOutcomeButton;
