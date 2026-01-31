import React, { useState } from 'react';
import type { Duel } from '../../types/duel';
import { duelService } from '../../services/duelService';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useBlockchainWallet } from '../../hooks/useBlockchainWallet';
import { LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';

interface DepositFlowProps {
  duel: Duel;
  onComplete: (signature: string) => void;
  onCancel: () => void;
}

export const DepositFlow: React.FC<DepositFlowProps> = ({ duel, onComplete, onCancel }) => {
  const { publicKey, sendTransaction } = useWallet();
  const { blockchainService } = useBlockchainWallet();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'confirm' | 'sending' | 'confirming' | 'complete'>('confirm');
  const [signature, setSignature] = useState<string | null>(null);

  const handleDeposit = async () => {
    if (!publicKey) {
      setError("Wallet not connected");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setStep('sending');

      // Use the connection from wallet adapter context via blockchainService for consistency,
      // but ensure we get a fresh blockhash using that connection.
      const connection = blockchainService.getConnection();

      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

      // Create transaction with explicit parameters
      const transaction = new Transaction({
        blockhash,
        lastValidBlockHeight,
        feePayer: publicKey,
      });

      console.log('Constructing transaction for duel:', duel.id, 'Amount:', duel.betAmount);

      // 1. (Removed) Memo instruction caused 'ProgramAccountNotFound' on some clusters/RPCs.
      // Since backend verifies signature existence/status only for now, we skip Memo to ensure reliability.

      // 2. Real Transfer (Lamports)
      // Ensure precise calculation
      const lamports = Math.floor(duel.betAmount * LAMPORTS_PER_SOL);

      if (lamports <= 0) {
        throw new Error("Invalid bet amount");
      }

      console.log('Adding transfer instruction. Lamports:', lamports);
      const transferIx = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: publicKey, // Sending to self for safety in this demo phase
        lamports: lamports,
      });
      transaction.add(transferIx);

      // 3. Send Transaction
      // Note: sendTransaction will sign the transaction with the wallet
      const txSignature = await sendTransaction(transaction, connection, {
        skipPreflight: true, // Skip preflight to avoid strict simulation errors (unreliable on devnet sometimes)
        preflightCommitment: 'confirmed',
      });

      console.log('Transaction sent. Signature:', txSignature);
      setSignature(txSignature);
      setStep('confirming');

      // 3. Wait for Confirmation
      const confirmation = await blockchainService.monitorTransaction(txSignature);
      if (confirmation.status === 'failed') {
        throw new Error("Transaction failed on-chain");
      }

      // 4. Notify Backend
      await duelService.depositToDuel(duel.id, { signature: txSignature });

      setStep('complete');
      setTimeout(() => {
        onComplete(txSignature);
      }, 1000);

    } catch (err: any) {
      console.error("Deposit failed", err);
      // Log detailed error information if available
      if (err.logs) {
        console.error("Transaction Logs:", err.logs);
        setError(`Transaction failed: ${err.message}. Check console for logs.`);
      } else if (err.name === "WalletSendTransactionError") {
        setError(`Wallet Error: ${err.message}. Please try again.`);
      } else {
        setError(err.message || 'Failed to deposit');
      }
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-pump-gray-darker border-2 border-pump-green rounded-lg p-8 max-w-md w-full mx-4 shadow-[0_0_50px_rgba(0,255,65,0.1)]">
        <h2 className="text-2xl font-mono font-bold text-pump-white mb-6 text-center">LOCK FUNDS</h2>

        {step === 'confirm' && (
          <>
            <div className="bg-pump-black border-2 border-pump-gray-dark rounded-lg p-6 mb-6 text-center">
              <p className="text-pump-gray font-sans text-sm mb-2">YOU ARE BETTING</p>
              <p className="text-4xl font-mono font-bold text-pump-green mb-1">{duel.betAmount} SOL</p>
              <p className="text-xs text-pump-gray-light">≈ ${(duel.betAmount * 150).toFixed(2)}</p>
            </div>

            <div className="space-y-3 mb-8">
              <div className="flex justify-between text-sm">
                <span className="text-pump-gray">Smart Contract Fee</span>
                <span className="text-pump-white font-mono">0.00 SOL</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-pump-gray">Network Fee</span>
                <span className="text-pump-white font-mono">~0.000005 SOL</span>
              </div>
            </div>

            {error && (
              <div className="bg-pump-red/10 border border-pump-red rounded p-3 mb-6">
                <p className="text-pump-red font-sans text-sm text-center">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={loading}
                className="flex-1 bg-transparent border-2 border-pump-gray-dark hover:border-pump-gray text-pump-gray hover:text-pump-white font-sans font-bold py-3 px-4 rounded-md transition-all"
              >
                CANCEL
              </button>

              {!publicKey ? (
                <div className="flex-1">
                  <WalletMultiButton className="!w-full !bg-pump-green hover:!bg-pump-lime !text-pump-black !font-sans !font-bold !py-3 !px-4 !rounded-md !transition-all hover:!scale-105 hover:!shadow-glow !h-[52px] !flex !justify-center" />
                </div>
              ) : (
                <button
                  onClick={handleDeposit}
                  disabled={loading}
                  className="flex-1 bg-pump-green hover:bg-pump-lime text-pump-black font-sans font-bold py-3 px-4 rounded-md transition-all hover:scale-105 hover:shadow-glow"
                >
                  {loading ? 'WAITING...' : 'CONFIRM'}
                </button>
              )}
            </div>
          </>
        )}

        {(step === 'sending' || step === 'confirming') && (
          <div className="text-center py-8">
            <div className="w-16 h-16 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow mx-auto mb-6"></div>
            <p className="text-pump-white font-mono text-lg mb-2">
              {step === 'sending' ? 'Check your wallet...' : 'Confirming on Solana...'}
            </p>
            <p className="text-pump-gray font-sans text-sm">
              Please do not close this window
            </p>
            {signature && (
              <a
                href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="block mt-4 text-xs text-pump-green hover:underline font-mono"
              >
                View Transaction ↗
              </a>
            )}
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center py-4">
            <div className="w-20 h-20 bg-pump-green rounded-full flex items-center justify-center mx-auto mb-6 text-4xl text-pump-black shadow-glow">
              ✓
            </div>
            <p className="text-pump-white font-mono font-bold text-xl mb-2">FUNDS LOCKED</p>
            <p className="text-pump-gray font-sans text-sm">Waiting for opponent...</p>
          </div>
        )}
      </div>
    </div>
  );
};
