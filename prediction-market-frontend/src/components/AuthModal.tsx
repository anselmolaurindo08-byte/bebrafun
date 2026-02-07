import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { CheckCircle } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import apiService from '../services/api';
import bs58 from 'bs58';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const { publicKey, signMessage, connected, disconnect } = useWallet();
    const { user, setUser, setToken } = useUserStore();
    const [inviteCode, setInviteCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const hasDisconnectedRef = useRef(false);

    // When modal opens and user is NOT authenticated, disconnect any PREVIOUSLY
    // connected wallet ONCE so the user gets a fresh wallet selection dialog.
    // Uses a ref to prevent re-disconnecting when the user actively connects.
    useEffect(() => {
        if (isOpen && !user?.wallet_address && connected && !hasDisconnectedRef.current) {
            hasDisconnectedRef.current = true;
            disconnect().catch(console.error);
        }
        // Reset the ref when modal closes so next open can disconnect again
        if (!isOpen) {
            hasDisconnectedRef.current = false;
        }
    }, [isOpen, user?.wallet_address, connected, disconnect]);

    const handleChangeWallet = async () => {
        try {
            await disconnect();
        } catch (e) {
            console.error('Failed to disconnect:', e);
        }
    };

    const handleWalletAuth = async () => {
        if (!publicKey || !connected) {
            setError('Please connect your wallet first');
            return;
        }

        if (!signMessage) {
            setError('Wallet does not support message signing');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const message = new TextEncoder().encode('Sign this message to authenticate with PUMPSLY');
            const signatureBytes = await signMessage(message);
            const signature = bs58.encode(signatureBytes);
            const walletAddress = publicKey.toString();

            const response = await apiService.walletLogin(walletAddress, signature, inviteCode || undefined);

            // Store token and user
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            setToken(response.token);
            setUser(response.user);

            onClose();
        } catch (err: any) {
            console.error('Wallet auth failed:', err);
            setError(err.response?.data?.error || err.message || 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const isAuthenticated = !!user?.wallet_address;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-8 shadow-2xl">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-pump-gray-light hover:text-pump-white transition-colors"
                >
                    ✕
                </button>

                {/* Title */}
                <h2 className="text-2xl font-mono font-bold text-pump-white mb-6 text-center">
                    {isAuthenticated ? 'Connected' : 'Connect Wallet'}
                </h2>

                {/* Content */}
                <div className="space-y-6">
                    {/* Wallet Section */}
                    <div className="space-y-4">
                        {connected && publicKey ? (
                            <>
                                <div className="flex items-center gap-3 p-4 bg-pump-black border-2 border-pump-green rounded-md">
                                    <div className="w-10 h-10 bg-pump-green rounded-full flex items-center justify-center text-pump-black font-bold">
                                        {publicKey.toString().substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-pump-gray-light font-sans">Wallet Address</p>
                                        <p className="text-sm font-mono text-pump-white truncate">
                                            {publicKey.toString()}
                                        </p>
                                    </div>
                                    <CheckCircle className="w-6 h-6 text-pump-green flex-shrink-0" />
                                </div>
                                {!isAuthenticated && (
                                    <button
                                        onClick={handleChangeWallet}
                                        className="w-full text-sm text-pump-gray-light hover:text-pump-green font-sans underline transition-colors"
                                    >
                                        Use a different wallet
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <p className="text-sm text-pump-gray-light font-sans text-center">
                                    Connect your Solana wallet to get started
                                </p>
                                <WalletMultiButton className="!bg-pump-green hover:!bg-pump-lime !text-pump-black !font-sans !font-semibold !py-3 !px-6 !rounded-md !transition-all !duration-200 hover:!scale-105 hover:!shadow-glow" />
                            </div>
                        )}
                    </div>

                    {/* Invite Code (optional) */}
                    {connected && !isAuthenticated && (
                        <div className="space-y-2">
                            <label className="block text-xs font-sans font-semibold text-pump-gray-light">
                                INVITE CODE (OPTIONAL)
                            </label>
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                placeholder="Enter invite code"
                                className="w-full px-4 py-3 bg-pump-black border-2 border-pump-gray-dark rounded-md text-pump-white font-mono focus:border-pump-green focus:outline-none transition-colors"
                            />
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-pump-red/10 border border-pump-red rounded-md">
                            <p className="text-sm text-pump-red font-sans">{error}</p>
                        </div>
                    )}

                    {/* Auth Button */}
                    {connected && !isAuthenticated && (
                        <button
                            onClick={handleWalletAuth}
                            disabled={isLoading}
                            className="w-full bg-pump-green hover:bg-pump-lime text-pump-black font-sans font-semibold py-3 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 hover:shadow-glow"
                        >
                            {isLoading ? 'SIGN MESSAGE TO AUTHENTICATE' : 'SIGN IN'}
                        </button>
                    )}

                    {/* Success State */}
                    {isAuthenticated && (
                        <div className="text-center space-y-4">
                            <div className="flex items-center justify-center gap-2 text-pump-green">
                                <CheckCircle className="w-6 h-6" />
                                <span className="font-sans font-semibold">Successfully Connected</span>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-full bg-pump-gray-dark hover:bg-pump-gray text-pump-white font-sans font-semibold py-3 px-4 rounded-md transition-colors"
                            >
                                CLOSE
                            </button>
                        </div>
                    )}

                    {/* Info Text */}
                    {!connected && (
                        <p className="text-xs text-pump-gray font-sans text-center">
                            Connect with Phantom, Solflare, or any Solana wallet
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
