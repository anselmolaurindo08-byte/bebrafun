import React, { useState, useEffect } from 'react';

interface CountdownOverlayProps {
    startingAt: string;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ startingAt }) => {
    const [countdown, setCountdown] = useState<number>(5);

    useEffect(() => {
        const startingTime = new Date(startingAt).getTime();

        const updateCountdown = () => {
            const elapsed = Date.now() - startingTime;
            const remaining = Math.max(0, 5000 - elapsed); // 5 seconds in ms
            const secondsLeft = Math.ceil(remaining / 1000);

            setCountdown(secondsLeft);

            if (remaining > 0) {
                requestAnimationFrame(updateCountdown);
            }
        };

        updateCountdown();
    }, [startingAt]);

    if (countdown <= 0) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="text-center space-y-6 animate-pulse">
                <h2 className="text-5xl font-bold text-pump-green uppercase tracking-wider">
                    PREPARING DUEL
                </h2>

                <div className="relative">
                    <div className="text-9xl font-mono font-bold text-white drop-shadow-[0_0_30px_rgba(0,255,0,0.5)]">
                        {countdown}
                    </div>
                    <div className="absolute inset-0 text-9xl font-mono font-bold text-pump-green opacity-20 blur-xl">
                        {countdown}
                    </div>
                </div>

                <p className="text-xl text-pump-gray animate-pulse">
                    Recording entry price...
                </p>

                <div className="flex justify-center gap-2 mt-8">
                    {[...Array(5)].map((_, i) => (
                        <div
                            key={i}
                            className={`w-3 h-3 rounded-full transition-all duration-300 ${i < (5 - countdown)
                                    ? 'bg-pump-green shadow-[0_0_10px_rgba(0,255,0,0.8)]'
                                    : 'bg-gray-700'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
