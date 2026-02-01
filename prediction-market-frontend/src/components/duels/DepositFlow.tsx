import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { Duel } from '../../types/duel';
import { duelService } from '../../services/duelService';
import { blockchainService } from '../../services/blockchainService';

interface DepositFlowProps {
  duel: Duel;
  onComplete: (signature: string) => void;
  onCancel: () => void;
}

export const DepositFlow: React.FC<DepositFlowProps> = ({ duel, onComplete, onCancel }) => {
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'confirm' | 'sending' | 'confirming' | 'complete'>('confirm');
  const [signature, setSignature] = useState<string | null>(null);

  const handleDeposit = async () => {
    try {
      setLoading(true);
      setError(null);
      setStep('sending');

      // 1. Check wallet connection
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      // 2. Get server wallet address from backend
      const config = await duelService.getConfig();
      const serverWallet = new PublicKey(config.serverWallet);

      // 3. Create SOL transfer transaction
      const connection = blockchainService.getConnection();
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: serverWallet,
          lamports: duel.betAmount * LAMPORTS_PER_SOL,
        })
      );

      // 4. Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // 5. Send transaction
      const txSignature = await sendTransaction(transaction, connection);
      setSignature(txSignature);

      // 6. Wait for confirmation
      setStep('confirming');
      await connection.confirmTransaction(txSignature, 'confirmed');

      // 7. Send signature to backend
      await duelService.depositToDuel(duel.id, { signature: txSignature });

      setStep('complete');
      onComplete(txSignature);
    } catch (err: any) {
      console.error('Deposit error:', err);
      setError(err.message || 'Failed to deposit');
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-mono font-bold text-pump-white mb-6">Deposit to Duel</h2>

        {step === 'confirm' && (
          <>
            <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-4 mb-6">
              <p className="text-pump-gray font-sans text-sm mb-2">Amount to Deposit</p>
              <p className="text-3xl font-mono font-bold text-pump-green">{duel.betAmount} SOL</p>
            </div>

            <div className="bg-pump-yellow/10 border-2 border-pump-yellow/30 rounded-lg p-4 mb-6">
              <p className="text-pump-yellow font-sans text-sm">
                ⚠️ This will transfer {duel.betAmount} SOL from your wallet to the duel escrow.
              </p>
            </div>

            {error && (
              <div className="bg-pump-gray-darker border-2 border-pump-red rounded-lg p-3 mb-6">
                <p className="text-pump-red font-sans text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={loading}
                className="flex-1 bg-pump-gray-dark hover:bg-pump-gray text-pump-white font-sans font-semibold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                disabled={loading || !publicKey}
                className="flex-1 bg-pump-green hover:bg-pump-lime text-pump-black font-sans font-semibold py-2 px-4 rounded-md transition-all duration-200 hover:scale-105 disabled:bg-pump-gray-dark disabled:text-pump-gray"
              >
                {loading ? 'Processing...' : 'Confirm Deposit'}
              </button>
            </div>
          </>
        )}

        {step === 'sending' && (
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow mx-auto mb-4"></div>
            <p className="text-pump-gray-light font-sans">Sending transaction...</p>
          </div>
        )}

        {step === 'confirming' && (
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow mx-auto mb-4"></div>
            <p className="text-pump-gray-light font-sans">Confirming on blockchain...</p>
            {signature && <p className="text-xs text-pump-gray font-mono mt-2 break-all">{signature}</p>}
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center">
            <div className="text-4xl text-pump-green mb-4">✓</div>
            <p className="text-pump-green font-mono font-bold mb-4">Deposit Successful!</p>
            <p className="text-pump-gray-light font-sans text-sm mb-6">Your SOL is now in the duel escrow.</p>
            <button
              onClick={onCancel}
              className="w-full bg-pump-green hover:bg-pump-lime text-pump-black font-sans font-semibold py-2 px-4 rounded-md transition-all duration-200 hover:scale-105"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
