import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { duelService } from '../services/duelService';
import './CancelDuelButton.css';

interface CancelDuelButtonProps {
    duel: any; // TODO: Add proper Duel type
    onSuccess?: () => void;
}

function CancelDuelButton({ duel, onSuccess }: CancelDuelButtonProps) {
    const { publicKey } = useWallet();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [canCancel, setCanCancel] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(0);

    useEffect(() => {
        // Check if user is player 1 and can cancel
        if (!publicKey || !duel) return;

        const isPlayer1 = publicKey.toString() === duel.player1;
        const hasPlayer2 = duel.player2 !== null;
        const currentTime = Math.floor(Date.now() / 1000);
        const createdAt = duel.createdAt;
        const timeoutSeconds = 300; // 5 minutes
        const canCancelTime = createdAt + timeoutSeconds;

        setCanCancel(isPlayer1 && !hasPlayer2 && currentTime >= canCancelTime);
        setTimeRemaining(Math.max(0, canCancelTime - currentTime));

        // Update timer every second
        const interval = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = Math.max(0, canCancelTime - now);
            setTimeRemaining(remaining);

            if (remaining === 0 && isPlayer1 && !hasPlayer2) {
                setCanCancel(true);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [publicKey, duel]);

    const handleCancel = async () => {
        if (!publicKey || !canCancel) return;

        setLoading(true);
        setError(null);

        try {
            // Call backend API which will handle smart contract interaction
            await duelService.cancelDuel(duel.id);

            console.log('✅ Duel cancelled successfully');
            alert('Duel cancelled successfully! Your SOL has been refunded.');

            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            console.error('❌ Error cancelling duel:', err);
            setError(err.response?.data?.error || err.message || 'Failed to cancel duel');
        } finally {
            setLoading(false);
        }
    };

    // Don't show if not player 1
    if (!publicKey || publicKey.toString() !== duel?.player1) {
        return null;
    }

    // Don't show if player 2 joined
    if (duel?.player2) {
        return null;
    }

    return (
        <div className="cancel-duel-section">
            {!canCancel && timeRemaining > 0 && (
                <div className="waiting-message">
                    <p>⏳ You can cancel this duel in {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</p>
                    <p className="help-text">Duels can be cancelled after 5 minutes if no one joins</p>
                </div>
            )}

            {canCancel && (
                <>
                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleCancel}
                        disabled={loading}
                        className="cancel-duel-btn"
                    >
                        {loading ? 'Cancelling...' : 'Cancel Duel & Get Refund'}
                    </button>

                    <p className="help-text">
                        You will receive your full stake back
                    </p>
                </>
            )}
        </div>
    );
}

export default CancelDuelButton;
