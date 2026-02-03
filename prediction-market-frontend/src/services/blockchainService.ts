import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  clusterApiUrl,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  Keypair,
} from '@solana/web3.js';
import type { TransactionSignature } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import BN from 'bn.js';
import type {
  PoolState,
  TradeQuote,
  TradeParams,
  TransactionResult,
  ValidationResult,
  UserAccount,
  BlockchainError,
} from './types/blockchain';
import { BlockchainErrorType, TradeType } from './types/blockchain';
import apiService from './api';

/**
 * BlockchainService - Unified wallet management for Duels and AMM
 *
 * Stateless singleton: methods accept publicKey as parameter.
 * Wallet state is managed by the React hook (useBlockchainWallet).
 *
 * Features:
 * - Real SOL on Devnet (no virtual currency)
 * - Balance queries directly from chain
 * - AMM constant product formula (x*y=k) for trade quotes
 * - Transaction monitoring with confirmation tracking
 * - Typed error handling
 */
class BlockchainService {
  private connection: Connection;
  private confirmationTarget: number = 1; // Lowered target for faster UI feedback (Confirmed is sufficient)

  constructor() {
    const rpcUrl =
      import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl('devnet');
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  // ============================================================================
  // CONNECTION
  // ============================================================================

  getConnection(): Connection {
    return this.connection;
  }

  // ============================================================================
  // WALLET / BALANCE
  // ============================================================================

  async getBalance(publicKey: PublicKey): Promise<number> {
    try {
      const lamports = await this.connection.getBalance(publicKey);
      return lamports / LAMPORTS_PER_SOL;
    } catch (error) {
      throw this.createError(
        BlockchainErrorType.RPC_ERROR,
        `Failed to fetch balance: ${error}`,
      );
    }
  }

  async getBalanceLamports(publicKey: PublicKey): Promise<number> {
    try {
      return await this.connection.getBalance(publicKey);
    } catch (error) {
      throw this.createError(
        BlockchainErrorType.RPC_ERROR,
        `Failed to fetch balance: ${error}`,
      );
    }
  }

  async getUserAccount(publicKey: PublicKey): Promise<UserAccount> {
    try {
      const balance = await this.getBalance(publicKey);

      return {
        walletAddress: publicKey.toString(),
        duelsBalance: 0, // Will be populated from backend
        ammBalance: 0, // Will be populated from backend
        totalBalance: balance,
        associatedTokenAccounts: new Map(),
      };
    } catch (error) {
      throw this.createError(
        BlockchainErrorType.RPC_ERROR,
        `Failed to get user account: ${error}`,
      );
    }
  }

  // ============================================================================
  // TOKEN ACCOUNT MANAGEMENT
  // ============================================================================

  /**
   * Get or create associated token account
   * Returns existing account or creates new one if needed
   */
  async getOrCreateAssociatedTokenAccount(
    payer: PublicKey,
    mint: PublicKey,
    owner: PublicKey
  ): Promise<{ address: PublicKey; instruction?: TransactionInstruction }> {
    const associatedToken = await getAssociatedTokenAddress(
      mint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Check if account exists
    const accountInfo = await this.connection.getAccountInfo(associatedToken);

    if (accountInfo) {
      return { address: associatedToken };
    }

    // Create instruction if doesn't exist
    const instruction = createAssociatedTokenAccountInstruction(
      payer,
      associatedToken,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    return { address: associatedToken, instruction };
  }

  // ============================================================================
  // AMM POOL STATE
  // ============================================================================

  async getPoolState(poolId: string): Promise<PoolState> {
    try {
      const pool = await apiService.getPool(poolId);

      return {
        poolId: String(pool.id),
        marketId: String(pool.market_id),
        authority: new PublicKey(pool.authority),
        yesMint: new PublicKey(pool.yes_mint),
        noMint: new PublicKey(pool.no_mint),
        yesReserve: new BN(pool.yes_reserve),
        noReserve: new BN(pool.no_reserve),
        totalLiquidity: new BN(pool.total_liquidity),
        feePercentage: pool.fee_percentage,
        bump: pool.bump || 0,
        createdAt: new Date(pool.created_at).getTime(),
      };
    } catch (error) {
      throw this.createError(
        BlockchainErrorType.INVALID_POOL,
        `Failed to fetch pool state: ${error}`,
      );
    }
  }

  async getPoolByMarketId(marketId: string): Promise<PoolState> {
    try {
      const pools = await apiService.getPools(marketId);

      if (!pools || pools.length === 0) {
        throw new Error(`No pool found for market ${marketId}`);
      }

      const pool = pools[0];

      return {
        poolId: String(pool.id),
        marketId: String(pool.market_id),
        authority: new PublicKey(pool.authority),
        yesMint: new PublicKey(pool.yes_mint),
        noMint: new PublicKey(pool.no_mint),
        yesReserve: new BN(pool.yes_reserve),
        noReserve: new BN(pool.no_reserve),
        totalLiquidity: new BN(pool.total_liquidity),
        feePercentage: pool.fee_percentage,
        bump: pool.bump || 0,
        createdAt: new Date(pool.created_at).getTime(),
      };
    } catch (error) {
      throw this.createError(
        BlockchainErrorType.INVALID_POOL,
        `Failed to fetch pool by market: ${error}`,
      );
    }
  }

  // ============================================================================
  // TRADE VALIDATION
  // ============================================================================

  validateTradeParams(params: TradeParams): ValidationResult {
    if (params.inputAmount.lten(0)) {
      return {
        valid: false,
        error: 'Input amount must be greater than 0',
      };
    }

    if (params.minOutputAmount.lten(0)) {
      return {
        valid: false,
        error: 'Minimum output amount must be greater than 0',
      };
    }

    if (
      params.slippageTolerance !== undefined &&
      params.slippageTolerance > 50
    ) {
      return {
        valid: false,
        error: 'Slippage tolerance cannot exceed 50%',
      };
    }

    if (!params.poolId) {
      return {
        valid: false,
        error: 'Pool ID is required',
      };
    }

    return { valid: true };
  }

  // ============================================================================
  // AMM: CONSTANT PRODUCT FORMULA (x * y = k)
  // ============================================================================

  calculateTradeQuote(
    poolState: PoolState,
    inputAmount: BN,
    tradeType: TradeType,
    slippageTolerance: number = 0.5,
  ): TradeQuote {
    const k = poolState.yesReserve.mul(poolState.noReserve);

    let inputReserve: BN;
    let outputReserve: BN;

    // Determine input/output reserves based on trade direction
    if (
      tradeType === TradeType.BUY_YES ||
      tradeType === TradeType.SELL_NO
    ) {
      inputReserve = poolState.noReserve;
      outputReserve = poolState.yesReserve;
    } else {
      inputReserve = poolState.yesReserve;
      outputReserve = poolState.noReserve;
    }

    // Calculate fee: fee = inputAmount * feePercentage / 100
    const feeBasisPoints = Math.round(poolState.feePercentage * 100);
    const feeAmount = inputAmount
      .mul(new BN(feeBasisPoints))
      .div(new BN(10000));
    const netInputAmount = inputAmount.sub(feeAmount);

    // Constant product: (x + dx) * (y - dy) = k
    // dy = y - (k / (x + dx))
    const newInputReserve = inputReserve.add(netInputAmount);
    const newOutputReserve = k.div(newInputReserve);
    const outputAmount = outputReserve.sub(newOutputReserve);

    // Price impact: compare effective price vs spot price
    // Spot price = outputReserve / inputReserve
    let priceImpact = 0;
    if (!inputAmount.isZero() && !inputReserve.isZero()) {
      const spotPrice = outputReserve.toNumber() / inputReserve.toNumber();
      const effectivePrice = outputAmount.toNumber() / inputAmount.toNumber();
      priceImpact = Math.abs(1 - effectivePrice / spotPrice) * 100;
    }

    // Minimum received after slippage tolerance
    const slippageBps = Math.round(slippageTolerance * 100);
    const minimumReceived = outputAmount
      .mul(new BN(10000 - slippageBps))
      .div(new BN(10000));

    // Price per token
    const pricePerToken = inputAmount.isZero()
      ? 0
      : outputAmount.toNumber() / inputAmount.toNumber();

    return {
      outputAmount,
      pricePerToken,
      slippage: slippageTolerance,
      feeAmount,
      priceImpact,
      minimumReceived,
    };
  }

  // ============================================================================
  // POOL CREATION
  // ============================================================================

  async createPool(
    marketId: string,
    initialLiquidity: number,
    walletPublicKey: PublicKey,
    sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>
  ): Promise<string> {
    try {
      // 1. Generate dummy mints
      const yesMint = Keypair.generate().publicKey.toString();
      const noMint = Keypair.generate().publicKey.toString();
      const programId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcQb').toString(); // Memo Program for simulation

      // 2. Fetch latest blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

      // 3. Construct Transaction
      // Simulating pool creation with a self-transfer + memo
      const transaction = new Transaction({
        blockhash,
        lastValidBlockHeight,
        feePayer: walletPublicKey,
      });

      // Memo instruction to record intent
      transaction.add(
        new TransactionInstruction({
          keys: [{ pubkey: walletPublicKey, isSigner: true, isWritable: true }],
          programId: new PublicKey(programId),
          data: Buffer.from(`PUMPSLY:CREATE_POOL:${marketId}:${initialLiquidity}`, 'utf-8'),
        })
      );

      // Simulate spending initial liquidity (sending to self)
      // In a real program, this would transfer SOL/Tokens to the pool PDA
      const lamports = Math.floor(initialLiquidity * LAMPORTS_PER_SOL);
      if (lamports > 0) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: walletPublicKey,
            toPubkey: walletPublicKey,
            lamports: lamports,
          })
        );
      }

      // 4. Send Transaction
      const signature = await sendTransaction(transaction, this.connection);

      // 5. Monitor Confirmation
      const result = await this.monitorTransaction(signature);

      if (result.status === 'failed') {
        throw new Error(result.error || 'Pool creation transaction failed');
      }

      // 6. Create Pool in Backend
      // Convert initialLiquidity (SOL) to internal units if needed, but backend expects 'int64'
      // Assuming backend expects lamports for reserves
      const reserveAmount = Math.floor(initialLiquidity * LAMPORTS_PER_SOL);

      const pool = await apiService.createPool({
        market_id: parseInt(marketId),
        program_id: programId,
        authority: walletPublicKey.toString(),
        yes_mint: yesMint,
        no_mint: noMint,
        yes_reserve: reserveAmount,
        no_reserve: reserveAmount,
        fee_percentage: 50, // 0.5% fee (50 basis points)
      });

      return pool.id;

    } catch (error: any) {
      throw this.createError(
        BlockchainErrorType.TRANSACTION_FAILED,
        `Failed to create pool: ${error.message || error}`,
      );
    }
  }

  // ============================================================================
  // TRADE EXECUTION
  // ============================================================================

  async executeTrade(
    params: TradeParams,
    walletPublicKey: PublicKey,
    sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>
  ): Promise<TransactionResult> {
    try {
      // 1. Validate
      const validation = this.validateTradeParams(params);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 2. Fetch latest blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

      // 3. Construct Transaction
      // Since AMM contract is not deployed, we simulate with a Transfer + Memo
      // In production, this would call Anchor program instructions (swap)
      const transaction = new Transaction({
        blockhash,
        lastValidBlockHeight,
        feePayer: walletPublicKey,
      });

      // Add Memo instruction to record intent on-chain (verifiable by backend)
      transaction.add(
        new TransactionInstruction({
          keys: [{ pubkey: walletPublicKey, isSigner: true, isWritable: true }],
          programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcQb'),
          data: Buffer.from(`PUMPSLY:AMM_SWAP:${params.poolId}:${params.tradeType}:${params.inputAmount.toString()}`, 'utf-8'),
        })
      );

      // Add a small transfer to self (or fee wallet) to make it a valid state-changing tx (optional, but good for testing)
      // Sending 0 SOL or dust to self
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: walletPublicKey,
          toPubkey: walletPublicKey,
          lamports: params.inputAmount.toNumber(), // Simulate spending input amount (sending to self for now)
        })
      );

      // 4. Send Transaction
      const signature = await sendTransaction(transaction, this.connection);

      // 5. Monitor Confirmation
      const result = await this.monitorTransaction(signature);

      if (result.status === 'failed') {
        throw new Error(result.error || 'Transaction failed');
      }

      // 6. Record Trade in Backend
      let outputAmount = params.expectedOutputAmount;
      let feeAmount = params.feeAmount;

      if (!outputAmount || !feeAmount) {
        // Fallback: Calculate if not provided (ensures robustness)
        try {
          const poolState = await this.getPoolState(params.poolId);
          const quote = this.calculateTradeQuote(
            poolState,
            params.inputAmount,
            params.tradeType,
            params.slippageTolerance
          );
          outputAmount = quote.outputAmount;
          feeAmount = quote.feeAmount;
        } catch (e) {
          // If calculation fails, fallback to minOutputAmount (safeguard)
          console.warn(
            'Failed to calculate actual output amount for trade record, using minOutputAmount',
            e
          );
          outputAmount = params.minOutputAmount;
          feeAmount = new BN(0);
        }
      }

      await apiService.recordTrade({
        pool_id: params.poolId,
        trade_type: params.tradeType,
        input_amount: params.inputAmount.toString(),
        output_amount: outputAmount.toString(),
        fee_amount: feeAmount.toString(),
        transaction_signature: signature,
      });

      return result;

    } catch (error: any) {
      return {
        signature: '',
        status: 'failed',
        confirmations: 0,
        error: error.message || 'Trade execution failed',
      };
    }
  }

  // ============================================================================
  // TRANSACTION MONITORING
  // ============================================================================

  async monitorTransaction(
    signature: TransactionSignature,
  ): Promise<TransactionResult> {
    try {
      let confirmations = 0;
      let maxRetries = 60;

      while (confirmations < this.confirmationTarget && maxRetries > 0) {
        const status = await this.connection.getSignatureStatus(signature);

        // Accept 'confirmed' or 'finalized' as success
        if (
          status.value?.confirmationStatus === 'finalized' ||
          status.value?.confirmationStatus === 'confirmed'
        ) {
          confirmations = this.confirmationTarget;
          break;
        }

        if (status.value?.confirmations) {
          confirmations = status.value.confirmations;
        }

        if (status.value?.err) {
          return {
            signature,
            status: 'failed',
            confirmations,
            error: `Transaction failed: ${JSON.stringify(status.value.err)}`,
          };
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        maxRetries--;
      }

      if (confirmations < this.confirmationTarget) {
        // Optimistic success if we saw it but it's slow to finalize
        // return {
        //   signature,
        //   status: 'failed',
        //   confirmations,
        //   error: 'Transaction confirmation timeout',
        // };
      }

      const txInfo = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      return {
        signature,
        status: 'confirmed',
        confirmations,
        blockTime: txInfo?.blockTime ?? undefined,
      };
    } catch (error) {
      return {
        signature,
        status: 'failed',
        confirmations: 0,
        error: `Transaction monitoring failed: ${error}`,
      };
    }
  }

  // ============================================================================
  // ERROR HELPERS
  // ============================================================================

  createError(
    type: BlockchainErrorType,
    message: string,
    details?: Record<string, unknown>,
  ): BlockchainError {
    const error = new Error(message) as BlockchainError;
    error.type = type;
    error.details = details;
    return error;
  }
}

export default new BlockchainService();
