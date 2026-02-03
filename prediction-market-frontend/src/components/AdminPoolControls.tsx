import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import blockchainService from '../services/blockchainService';
import './AdminPoolControls.css';

interface AdminPoolControlsProps {
    pool: any; // TODO: Add proper Pool type
    onSuccess?: () => void;
}

function AdminPoolControls({ pool, onSuccess }: AdminPoolControlsProps) {
    const { publicKey } = useWallet();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if user is pool authority
    const isAuthority = publicKey && publicKey.toString() === pool.authority;

    const handleClosePool = async () => {
        if (!publicKey || !isAuthority) return;

        const confirmed = window.confirm(
            'Are you sure you want to close this pool early? This action cannot be undone.'
        );

        if (!confirmed) return;

        setLoading(true);
        setError(null);

        try {
            const tx = await blockchainService.updatePoolStatus(
                pool.id,
                'resolved'
            );

            console.log('✅ Pool closed:', tx);
            alert('Pool closed successfully!');

            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            console.error('❌ Error closing pool:', err);
            setError(err.message || 'Failed to close pool');
        } finally {
            setLoading(false);
        }
    };

    const handleReopenPool = async () => {
        if (!publicKey || !isAuthority) return;

        const confirmed = window.confirm(
            'Are you sure you want to reopen this pool?'
        );

        if (!confirmed) return;

        setLoading(true);
        setError(null);

        try {
            const tx = await blockchainService.updatePoolStatus(
                pool.id,
                'active'
            );

            console.log('✅ Pool reopened:', tx);
            alert('Pool reopened successfully!');

            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            console.error('❌ Error reopening pool:', err);
            setError(err.message || 'Failed to reopen pool');
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthority) {
        return null; // Only show to pool authority
    }

    return (
        <div className="admin-controls">
            <h3>🔧 Admin Controls</h3>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="pool-status-info">
                <p>Current Status: <strong>{pool.status}</strong></p>
            </div>

            <div className="admin-buttons">
                {pool.status === 'active' && (
                    <button
                        onClick={handleClosePool}
                        disabled={loading}
                        className="close-pool-btn"
                    >
                        {loading ? 'Closing...' : 'Close Pool Early'}
                    </button>
                )}

                {pool.status === 'resolved' && (
                    <button
                        onClick={handleReopenPool}
                        disabled={loading}
                        className="reopen-pool-btn"
                    >
                        {loading ? 'Reopening...' : 'Reopen Pool'}
                    </button>
                )}
            </div>

            <p className="warning-text">
                ⚠️ Closing a pool will prevent new trades. Users can still claim winnings.
            </p>
        </div>
    );
}

export default AdminPoolControls;
