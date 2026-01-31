import React, { useEffect, useState } from 'react';

interface CountdownTimerProps {
  startFrom?: number;
  onComplete: () => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  startFrom = 3,
  onComplete,
}) => {
  const [count, setCount] = useState<number>(startFrom);
  const [phase, setPhase] = useState<'counting' | 'go' | 'done'>('counting');
  // Key to re-trigger animation on each count change
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (phase === 'done') return;

    if (phase === 'go') {
      const timer = setTimeout(() => {
        setPhase('done');
        onComplete();
      }, 1000);
      return () => clearTimeout(timer);
    }

    // counting phase
    if (count <= 0) {
      setPhase('go');
      return;
    }

    const timer = setTimeout(() => {
      setCount((prev) => prev - 1);
      setAnimKey((prev) => prev + 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, phase, onComplete]);

  if (phase === 'done') return null;

  const getCountColor = () => {
    if (phase === 'go') return 'text-pump-green';
    if (count === 1) return 'text-pump-red';
    if (count === 2) return 'text-pump-yellow';
    return 'text-pump-white';
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="text-center">
        {phase === 'counting' && (
          <div
            key={animKey}
            className={`text-[10rem] leading-none font-mono font-bold ${getCountColor()} animate-countdown-pulse drop-shadow-[0_0_40px_rgba(0,255,65,0.5)]`}
          >
            {count}
          </div>
        )}

        {phase === 'go' && (
          <div className="animate-go-pulse">
            <div className="text-[8rem] leading-none font-mono font-bold text-pump-green drop-shadow-[0_0_60px_rgba(0,255,65,0.8)]">
              GO!
            </div>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex justify-center gap-3 mt-10">
          {Array.from({ length: startFrom }, (_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                i < startFrom - count
                  ? 'bg-pump-green shadow-glow'
                  : 'bg-pump-gray-dark'
              }`}
            />
          ))}
        </div>

        <p className="text-pump-gray font-sans text-sm mt-6">
          {phase === 'go' ? 'Duel starting!' : 'Get ready...'}
        </p>
      </div>
    </div>
  );
};
