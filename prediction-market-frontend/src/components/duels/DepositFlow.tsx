import React, { useState } from 'react';
import type { Duel } from '../../types/duel';
import { duelService } from '../../services/duelService';

interface DepositFlowProps {
  duel: Duel;
  onComplete: (signature: string) => void;
  onCancel: () => void;
}

export const DepositFlow: React.FC<DepositFlowProps> = ({ duel, onComplete, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'confirm' | 'sending' | 'confirming' | 'complete'>('confirm');
  const [signature, setSignature] = useState<string | null>(null);

  const handleDeposit = async () => {
    try {
      setLoading(true);
      setError(null);
      setStep('sending');

      // Create transaction (this would be done by the backend/smart contract)
      // For now, we'll simulate the transaction
      const mockSignature = 'mock_signature_' + Date.now();
      setSignature(mockSignature);

      // Send to backend
      await duelService.depositToDuel(duel.id, { signature: mockSignature });

      setStep('confirming');

      // Wait for confirmation
      setTimeout(() => {
        setStep('complete');
        onComplete(mockSignature);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to deposit');
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-8 border border-gray-800 max-w-md w-full">
        <h2 className="text-2xl font-bold text-white mb-6">Deposit to Duel</h2>

        {step === 'confirm' && (
          <>
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <p className="text-gray-400 text-sm mb-2">Amount to Deposit</p>
              <p className="text-3xl font-bold text-green-400">{duel.bet_amount.toLocaleString()} Tokens</p>
            </div>

            <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-6">
              <p className="text-yellow-200 text-sm">
                ⚠️ Make sure you have enough tokens in your wallet before confirming.
              </p>
            </div>

            {error && (
              <div className="bg-red-900 border border-red-700 rounded-lg p-3 mb-6">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={loading}
                className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition"
              >
                {loading ? 'Processing...' : 'Confirm Deposit'}
              </button>
            </div>
          </>
        )}

        {step === 'sending' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-gray-300">Sending transaction...</p>
          </div>
        )}

        {step === 'confirming' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-gray-300">Confirming on blockchain...</p>
            {signature && <p className="text-xs text-gray-500 mt-2 break-all">{signature}</p>}
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center">
            <div className="text-4xl mb-4">✓</div>
            <p className="text-green-400 font-bold mb-4">Deposit Successful!</p>
            <p className="text-gray-400 text-sm mb-6">Your tokens are now in the duel escrow.</p>
            <button
              onClick={onCancel}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
