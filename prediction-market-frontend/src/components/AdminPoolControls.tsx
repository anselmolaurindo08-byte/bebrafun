import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import './AdminPoolControls.css';

interface AdminPoolControlsProps {
    pool: any;
    onSuccess?: () => void;
}

/**
 * Admin Pool Controls - Disabled for SOL-based system
 * Pool management is now handled directly through smart contracts
 */
function AdminPoolControls({ pool }: AdminPoolControlsProps) {
    const { publicKey } = useWallet();

    // Check if user is pool authority
    const isAuthority = publicKey && publicKey.toString() === pool.authority;

    if (!isAuthority) {
        return null;
    }

    return (
        <div className="admin-controls">
            <h3>🔧 Admin Controls</h3>

            <div className="pool-status-info">
                <p>Current Status: <strong>{pool.status}</strong></p>
            </div>

            <p className="warning-text">
                ℹ️ Pool management is handled through smart contracts in the SOL-based system.
            </p>
        </div>
    );
}

export default AdminPoolControls;
