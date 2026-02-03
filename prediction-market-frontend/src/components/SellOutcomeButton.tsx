import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
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
        if (!publicKey || !userPosition?.yesTokens) return;

        setLoading(true);
        setError(null);

        try {
            const tx = await blockchainService.sellOutcome(
                pool.id,
                'YES',
                userPosition.yesTokens, // Sell all YES tokens
                publicKey as PublicKey,
                5 // 5% slippage tolerance
            );

            console.log('✅ Sold YES tokens:', tx);
            alert('Successfully sold YES tokens!');

            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            console.error('❌ Error selling YES tokens:', err);
            setError(err.message || 'Failed to sell YES tokens');
        } finally {
            setLoading(false);
        }
    };

    const handleSellNo = async () => {
        if (!publicKey || !userPosition?.noTokens) return;

        setLoading(true);
        setError(null);

        try {
            const tx = await blockchainService.sellOutcome(
                pool.id,
                'NO',
                userPosition.noTokens, // Sell all NO tokens
                publicKey as PublicKey,
                5 // 5% slippage tolerance
            );

            console.log('✅ Sold NO tokens:', tx);
            alert('Successfully sold NO tokens!');

            if (onSuccess) {
                onSuccess();
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

    if (!userPosition || (userPosition.yesTokens === 0 && userPosition.noTokens === 0)) {
        return <div className="sell-outcome-message">No tokens to sell</div>;
    }

    return (
        <div className="sell-outcome-section">
            <h3>Sell Your Tokens</h3>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="sell-buttons">
                {userPosition.yesTokens > 0 && (
                    <button
                        onClick={handleSellYes}
                        disabled={loading}
                        className="sell-yes-btn"
                    >
                        {loading ? 'Selling...' : `Sell ${userPosition.yesTokens} YES tokens`}
                    </button>
                )}

                {userPosition.noTokens > 0 && (
                    <button
                        onClick={handleSellNo}
                        disabled={loading}
                        className="sell-no-btn"
                    >
                        {loading ? 'Selling...' : `Sell ${userPosition.noTokens} NO tokens`}
                    </button>
                )}
            </div>

            <p className="fee-notice">
                Fee: 0.3% • Slippage tolerance: 5%
            </p>
        </div>
    );
}

export default SellOutcomeButton;
