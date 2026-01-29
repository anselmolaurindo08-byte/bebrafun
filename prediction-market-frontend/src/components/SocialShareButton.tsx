import { useState } from 'react';
import apiService from '../services/api';

interface SocialShareButtonProps {
    marketId: number;
    pnlAmount: number;
    marketTitle: string;
}

export default function SocialShareButton({
    marketId,
    pnlAmount,
    marketTitle,
}: SocialShareButtonProps) {
    const [loading, setLoading] = useState(false);
    const [shared, setShared] = useState(false);

    // Only show for positive PnL
    if (pnlAmount <= 0) {
        return null;
    }

    const handleShareOnTwitter = async () => {
        setLoading(true);

        try {
            // Create tweet text
            const tweetText = `I just won $${pnlAmount.toFixed(2)} on "${marketTitle}" at Prediction Market! #PredictionMarket #Trading`;
            const tweetURL = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

            // Open Twitter share dialog
            window.open(tweetURL, '_blank', 'width=550,height=420');

            // Record the share and get bonus
            await apiService.shareWinOnTwitter({
                market_id: marketId,
                pnl_amount: pnlAmount.toString(),
                share_url: tweetURL,
            });

            setShared(true);
            const bonusAmount = (pnlAmount * 0.05).toFixed(2);
            alert(`Shared! You earned a 5% bonus: $${bonusAmount}`);
        } catch (error) {
            console.error('Failed to share:', error);
        } finally {
            setLoading(false);
        }
    };

    if (shared) {
        return (
            <div className="flex items-center gap-2 bg-pump-green/20 border-2 border-pump-green/30 text-pump-green font-sans font-semibold py-2 px-4 rounded-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Shared! +5% Bonus
            </div>
        );
    }

    return (
        <button
            onClick={handleShareOnTwitter}
            disabled={loading}
            className="flex items-center gap-2 bg-pump-cyan hover:bg-[#00F0FF] text-pump-black font-sans font-semibold py-2 px-4 rounded-md disabled:opacity-50 disabled:bg-pump-gray-dark disabled:text-pump-gray transition-all duration-200 hover:scale-105"
        >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
            </svg>
            {loading ? 'Sharing...' : 'Share & Earn 5%'}
        </button>
    );
}
