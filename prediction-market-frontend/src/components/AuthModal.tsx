import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useUserStore } from '../store/userStore';
import apiService from '../services/api';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    onAuthComplete?: () => void;
}

export default function AuthModal({
    isOpen,
    onClose,
    title = 'Connect to Continue',
    message,
    onAuthComplete
}: AuthModalProps) {
    const { user, token, setLoading } = useUserStore();
    const { publicKey, connected, disconnect, wallet } = useWallet();
    const [connectingWallet, setConnectingWallet] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Derived authentication states
    const isTwitterConnected = !!token && !!user?.x_username;
    const isWalletConnected = !!user?.wallet_address;
    const isBothConnected = isTwitterConnected && isWalletConnected;

    // Auto-link wallet when conditions are met
    useEffect(() => {
        const linkWallet = async () => {
            if (
                connected &&
                publicKey &&
                token &&
                !user?.wallet_address &&
                !connectingWallet
            ) {
                const walletAddress = publicKey.toString();

                setConnectingWallet(true);
                setError(null);

                try {
                    await apiService.connectWallet({ wallet_address: walletAddress });
                    const userData = await apiService.getCurrentUser();
                    useUserStore.getState().setUser(userData);
                } catch (err: any) {
                    console.error('Failed to link wallet:', err);
                    setError(err.response?.data?.error || 'Failed to connect wallet');
                    await disconnect();
                } finally {
                    setConnectingWallet(false);
                }
            }
        };

        linkWallet();
    }, [connected, publicKey, token, user?.wallet_address, connectingWallet, disconnect]);

    // Call onAuthComplete when both are connected
    useEffect(() => {
        if (isBothConnected && onAuthComplete) {
            onAuthComplete();
        }
    }, [isBothConnected, onAuthComplete]);

    const handleTwitterLogin = () => {
        setLoading(true);
        setError(null);
        apiService.login();
    };

    const walletName = wallet?.adapter?.name || 'Wallet';

    const shortenAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-pump-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-8 max-w-md w-full relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-pump-gray hover:text-pump-white transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Title */}
                <h2 className="text-2xl font-mono font-bold text-pump-white mb-2 text-center">
                    {title}
                </h2>

                {/* Optional Message */}
                {message && (
                    <p className="text-pump-gray-light font-sans text-sm text-center mb-6">
                        {message}
                    </p>
                )}

                {/* Error Display */}
                {error && (
                    <div className="bg-pump-gray-darker border-2 border-pump-red rounded-lg p-3 mb-6">
                        <p className="text-pump-red font-sans text-sm">{error}</p>
                    </div>
                )}

                <div className="space-y-6">
                    {/* Twitter Section */}
                    {isTwitterConnected ? (
                        <div className="flex items-center gap-3 bg-pump-gray-darker border-2 border-pump-green rounded-md p-4">
                            <span className="text-pump-green text-xl">✓</span>
                            {user?.x_avatar_url ? (
                                <img
                                    src={user.x_avatar_url}
                                    alt={user.x_username}
                                    className="w-8 h-8 rounded-full"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-pump-gray-dark flex items-center justify-center">
                                    <svg className="w-4 h-4 text-pump-gray" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                                    </svg>
                                </div>
                            )}
                            <span className="text-pump-white font-sans font-semibold">@{user.x_username}</span>
                        </div>
                    ) : null}

                    {/* Wallet Section */}
                    {isWalletConnected ? (
                        <div className="flex items-center gap-3 bg-pump-gray-darker border-2 border-pump-green rounded-md p-4">
                            <span className="text-pump-green text-xl">✓</span>
                            <span className="text-pump-white font-sans font-mono text-sm">
                                {shortenAddress(user.wallet_address!)}
                            </span>
                            <span className="text-pump-gray-light font-sans text-sm">{walletName}</span>
                        </div>
                    ) : null}

                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        {/* Twitter Button */}
                        {!isTwitterConnected && (
                            <button
                                onClick={handleTwitterLogin}
                                className="flex-1 bg-pump-green hover:bg-pump-lime text-pump-black font-bold py-4 px-6 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-glow font-sans text-sm"
                            >
                                SIGN IN WITH X.COM
                            </button>
                        )}

                        {/* Wallet Button */}
                        {!isWalletConnected && (
                            <div className={`${!isTwitterConnected ? 'flex-1' : 'w-full'}`}>
                                <WalletMultiButton
                                    className={`!w-full !bg-pump-green hover:!bg-pump-lime !text-pump-black !font-bold !py-4 !px-6 !rounded-md !transition-all !duration-200 !hover:scale-105 !font-sans !text-sm ${
                                        !isTwitterConnected ? '' : '!hover:shadow-glow'
                                    }`}
                                />
                            </div>
                        )}
                    </div>

                    {/* Connecting Spinner */}
                    {connectingWallet && (
                        <div className="text-center">
                            <div className="inline-block w-6 h-6 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow"></div>
                            <p className="text-pump-gray-light font-sans text-sm mt-2">
                                Linking wallet to your account...
                            </p>
                        </div>
                    )}

                    {/* Helper Text */}
                    {!isTwitterConnected && !isWalletConnected && (
                        <p className="text-pump-gray-light font-sans text-xs text-center">
                            Connect with either Twitter or Wallet to get started
                        </p>
                    )}
                </div>

                {/* Devnet Notice */}
                <div className="mt-6 bg-pump-cyan/10 border-2 border-pump-cyan/30 rounded-lg p-3">
                    <p className="text-pump-cyan font-sans text-xs">
                        <strong>Solana Devnet:</strong> Use Phantom or Solflare on Devnet.
                    </p>
                </div>
            </div>
        </div>
    );
}
