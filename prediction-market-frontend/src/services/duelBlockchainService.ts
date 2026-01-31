import {
  Connection,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import BN from 'bn.js';
import type { TransactionConfirmation } from '../types/duel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WalletAdapter = {
  publicKey: PublicKey | null;
  signTransaction?: (tx: Transaction) => Promise<Transaction>;
};

class DuelBlockchainService {
  private connection: Connection;
  private programId: PublicKey;

  constructor(
    rpcUrl: string = 'https://api.devnet.solana.com',
    programId?: string,
  ) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.programId = new PublicKey(
      programId ||
        import.meta.env.VITE_DUELS_PROGRAM_ID ||
        '11111111111111111111111111111111',
    );
  }

  /**
   * Get duel PDA address
   */
  getDuelPda(duelId: number): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('duel'), new BN(duelId).toBuffer('le', 8)],
      this.programId,
    );
    return pda;
  }

  /**
   * Check if duel account exists on-chain
   */
  async duelAccountExists(duelId: number): Promise<boolean> {
    try {
      const pda = this.getDuelPda(duelId);
      const accountInfo = await this.connection.getAccountInfo(pda);
      return accountInfo !== null;
    } catch {
      return false;
    }
  }

  /**
   * Create duel transaction
   */
  async createDuelTransaction(
    _duelId: number,
    _betAmount: number,
    _currency: number,
    _player1: PublicKey,
    wallet: WalletAdapter,
  ): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    try {
      const transaction = new Transaction();

      // TODO: Add create_duel instruction from IDL
      // transaction.add(
      //   program.methods
      //     .createDuel(new BN(duelId), new BN(betAmount), currency, player1)
      //     .accounts({...})
      //     .instruction()
      // );

      const { blockhash } = await this.connection.getLatestBlockhash(
        'confirmed',
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signed = await wallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(
        signed.serialize(),
        { skipPreflight: false, preflightCommitment: 'confirmed' },
      );

      return signature;
    } catch (error) {
      throw new Error(
        `Failed to create duel: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Join duel transaction
   */
  async joinDuelTransaction(
    _duelId: number,
    _player2: PublicKey,
    wallet: WalletAdapter,
  ): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    try {
      const transaction = new Transaction();

      // TODO: Add join_duel instruction from IDL
      // transaction.add(
      //   program.methods
      //     .joinDuel(player2)
      //     .accounts({...})
      //     .instruction()
      // );

      const { blockhash } = await this.connection.getLatestBlockhash(
        'confirmed',
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signed = await wallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(
        signed.serialize(),
        { skipPreflight: false, preflightCommitment: 'confirmed' },
      );

      return signature;
    } catch (error) {
      throw new Error(
        `Failed to join duel: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Deposit transaction
   */
  async depositTransaction(
    _duelId: number,
    _amount: number,
    _playerId: number,
    wallet: WalletAdapter,
  ): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    try {
      const transaction = new Transaction();

      // TODO: Add deposit instruction from IDL
      // transaction.add(
      //   program.methods
      //     .deposit(new BN(amount), playerId)
      //     .accounts({...})
      //     .instruction()
      // );

      const { blockhash } = await this.connection.getLatestBlockhash(
        'confirmed',
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signed = await wallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(
        signed.serialize(),
        { skipPreflight: false, preflightCommitment: 'confirmed' },
      );

      return signature;
    } catch (error) {
      throw new Error(
        `Failed to deposit: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Monitor transaction confirmations
   */
  async monitorConfirmations(
    signature: string,
    _requiredConfirmations: number = 6,
    maxRetries: number = 60,
  ): Promise<TransactionConfirmation> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const status = await this.connection.getSignatureStatus(signature);

        if (status.value?.confirmationStatus === 'confirmed') {
          return {
            transactionHash: signature,
            confirmations: status.value.confirmations || 1,
            status: 'confirmed',
            timestamp: Date.now(),
          };
        }

        if (status.value?.confirmationStatus === 'finalized') {
          return {
            transactionHash: signature,
            confirmations: 32,
            status: 'confirmed',
            timestamp: Date.now(),
          };
        }

        if (status.value?.err) {
          return {
            transactionHash: signature,
            confirmations: 0,
            status: 'failed',
            timestamp: Date.now(),
          };
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Error monitoring confirmations:', error);
      }
    }

    return {
      transactionHash: signature,
      confirmations: 0,
      status: 'pending',
      timestamp: Date.now(),
    };
  }

  /**
   * Check if transaction has enough confirmations
   */
  async hasEnoughConfirmations(
    signature: string,
    requiredConfirmations: number = 6,
  ): Promise<boolean> {
    try {
      const status = await this.connection.getSignatureStatus(signature);
      return (status.value?.confirmations || 0) >= requiredConfirmations;
    } catch (error) {
      console.error('Error checking confirmations:', error);
      return false;
    }
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(): Promise<boolean> {
    try {
      const version = await this.connection.getVersion();
      return !!version;
    } catch {
      return false;
    }
  }
}

export default new DuelBlockchainService();
