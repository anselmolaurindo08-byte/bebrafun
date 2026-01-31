import React, { useEffect, useRef } from 'react';
import { DUEL_CONSTANTS } from '../../types/duel';

interface TransactionConfirmationModalProps {
  transactionHash: string;
  confirmations: number;
  requiredConfirmations?: number;
  status: 'pending' | 'confirmed' | 'failed';
  onComplete: () => void;
  onClose: () => void;
}

export const TransactionConfirmationModal: React.FC<
  TransactionConfirmationModalProps
> = ({
  transactionHash,
  confirmations,
  requiredConfirmations = DUEL_CONSTANTS.REQUIRED_CONFIRMATIONS,
  status,
  onComplete,
  onClose,
}) => {
  const hasCalledComplete = useRef(false);

  useEffect(() => {
    if (status === 'confirmed' && !hasCalledComplete.current) {
      hasCalledComplete.current = true;
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, onComplete]);

  const progress = Math.min(
    (confirmations / requiredConfirmations) * 100,
    100,
  );

  const getStatusText = () => {
    if (status === 'failed') return 'Transaction Failed';
    if (status === 'confirmed') return 'Transaction Confirmed!';
    if (confirmations === 0) return 'Waiting for blockchain...';
    return `Confirming... ${confirmations}/${requiredConfirmations}`;
  };

  const getStatusColor = () => {
    if (status === 'failed') return 'text-pump-red';
    if (status === 'confirmed') return 'text-pump-green';
    return 'text-pump-yellow';
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-8 max-w-md w-full mx-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-mono font-bold text-pump-white">
            Transaction Status
          </h2>
          {status !== 'pending' && (
            <button
              onClick={onClose}
              className="text-pump-gray hover:text-pump-white transition-colors text-xl leading-none"
            >
              &times;
            </button>
          )}
        </div>

        {/* Status Icon */}
        <div className="flex justify-center mb-6">
          {status === 'failed' ? (
            <div className="w-16 h-16 rounded-full bg-pump-red/20 border-2 border-pump-red flex items-center justify-center">
              <span className="text-pump-red text-3xl">✕</span>
            </div>
          ) : status === 'confirmed' ? (
            <div className="w-16 h-16 rounded-full bg-pump-green/20 border-2 border-pump-green flex items-center justify-center">
              <span className="text-pump-green text-3xl">✓</span>
            </div>
          ) : (
            <div className="w-16 h-16 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow" />
          )}
        </div>

        {/* Status Text */}
        <p
          className={`text-center font-mono font-bold text-lg mb-6 ${getStatusColor()}`}
        >
          {getStatusText()}
        </p>

        {/* Progress Bar */}
        {status === 'pending' && (
          <div className="mb-6">
            <div className="w-full h-3 bg-pump-black rounded-full overflow-hidden border border-pump-gray-dark">
              <div
                className="h-full bg-pump-green rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-pump-gray font-mono text-xs">0</span>
              <span className="text-pump-gray-light font-mono text-xs">
                {confirmations} / {requiredConfirmations}
              </span>
              <span className="text-pump-gray font-mono text-xs">
                {requiredConfirmations}
              </span>
            </div>
          </div>
        )}

        {/* Transaction Hash */}
        <div className="bg-pump-black border border-pump-gray-dark rounded-lg p-3 mb-6">
          <p className="text-pump-gray font-sans text-xs mb-1">
            Transaction Hash
          </p>
          <p className="text-pump-gray-light font-mono text-xs break-all">
            {transactionHash}
          </p>
        </div>

        {/* Action Buttons */}
        {status === 'failed' && (
          <button
            onClick={onClose}
            className="w-full bg-pump-red hover:bg-red-400 text-pump-white font-sans font-semibold py-3 px-4 rounded-md transition-colors duration-200"
          >
            Close
          </button>
        )}

        {status === 'confirmed' && (
          <button
            onClick={onComplete}
            className="w-full bg-pump-green hover:bg-pump-lime text-pump-black font-sans font-semibold py-3 px-4 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-glow"
          >
            Continue
          </button>
        )}

        {status === 'pending' && (
          <p className="text-center text-pump-gray font-sans text-xs">
            Please wait while the transaction is being confirmed on the
            blockchain...
          </p>
        )}
      </div>
    </div>
  );
};
