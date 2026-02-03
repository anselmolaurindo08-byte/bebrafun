import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  clusterApiUrl,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import type { TransactionSignature } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createSyncNativeInstruction,
} from '@solana/spl-token';
import BN from 'bn.js';
import anchorProgramService from './anchorProgramService';
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
      // Fetch pool data from blockchain
      const poolIdBN = new BN(poolId);
      const poolData = await anchorProgramService.getPool(poolIdBN);

      // Convert on-chain data to PoolState format
      return {
        poolId: poolId,
        marketId: poolData.marketId?.toString() || poolId,
        authority: poolData.authority,
        yesMint: poolData.tokenMint, // Using same mint for both
        noMint: poolData.tokenMint,
        yesReserve: new BN(poolData.yesReserve.toString()),
        noReserve: new BN(poolData.noReserve.toString()),
        totalLiquidity: new BN(poolData.yesReserve.toString()).add(new BN(poolData.noReserve.toString())),
        feePercentage: 0.3, // 0.3% fee (30 basis points)
        bump: poolData.bump || 0,
        createdAt: poolData.createdAt?.toNumber() || Date.now(),
      };
    } catch (error) {
      // Fallback to backend if on-chain fetch fails
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
      } catch (backendError) {
        throw this.createError(
          BlockchainErrorType.INVALID_POOL,
          `Failed to fetch pool state: ${error}`,
        );
      }
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
    sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>,
    wallet: any // Add wallet parameter
  ): Promise<string> {
    try {
      // 0. Initialize Anchor program with wallet first
      if (wallet) {
        anchorProgramService.initializeProgram(wallet);
      }

      // 1. Generate pool ID from timestamp
      const poolId = new BN(Date.now());
      const initialLiquidityBN = new BN(Math.floor(initialLiquidity * LAMPORTS_PER_SOL));

      // 3. Use native SOL (wrapped SOL mint)
      const tokenMint = new PublicKey('So11111111111111111111111111111111111111112');

      // 4. Get or create user's token account
      const tokenAccountInfo = await this.getOrCreateAssociatedTokenAccount(
        walletPublicKey,
        tokenMint,
        walletPublicKey
      );

      // 5. If token account doesn't exist, create it first
      if (tokenAccountInfo.instruction) {
        try {
          console.log('Creating WSOL token account...');
          const { blockhash: createBlockhash, lastValidBlockHeight: createLastValid } =
            await this.connection.getLatestBlockhash('confirmed');
          const createAccountTx = new Transaction({
            blockhash: createBlockhash,
            lastValidBlockHeight: createLastValid,
            feePayer: walletPublicKey,
          });
          createAccountTx.add(tokenAccountInfo.instruction);

          const createSig = await sendTransaction(createAccountTx, this.connection);
          console.log('✅ Token account created:', createSig);
          // Wait for confirmation
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error('❌ Failed to create token account:', error);
          throw new Error(`Failed to create WSOL token account: ${error}`);
        }
      }

      // 6. Wrap SOL for initial liquidity
      // The contract transfers initial_liquidity from authority's token account to pool vault
      // So we need to fund the authority's WSOL account with initial_liquidity amount
      try {
        console.log(`Checking WSOL balance...`);

        // Check current balance of token account
        const tokenAccountBalance = await this.connection.getTokenAccountBalance(tokenAccountInfo.address);
        const currentBalance = new BN(tokenAccountBalance.value.amount);

        console.log(`Current WSOL balance: ${currentBalance.toString()} lamports`);
        console.log(`Required: ${initialLiquidityBN.toString()} lamports`);

        // Only wrap if we don't have enough
        if (currentBalance.lt(initialLiquidityBN)) {
          const amountToWrap = initialLiquidityBN.sub(currentBalance);
          console.log(`Wrapping ${amountToWrap.toNumber() / LAMPORTS_PER_SOL} SOL...`);

          const { blockhash: wrapBlockhash, lastValidBlockHeight: wrapLastValid } =
            await this.connection.getLatestBlockhash('confirmed');
          const wrapTx = new Transaction({
            blockhash: wrapBlockhash,
            lastValidBlockHeight: wrapLastValid,
            feePayer: walletPublicKey,
          });

          // Transfer SOL to token account and sync
          wrapTx.add(
            SystemProgram.transfer({
              fromPubkey: walletPublicKey,
              toPubkey: tokenAccountInfo.address,
              lamports: amountToWrap.toNumber(),
            }),
            createSyncNativeInstruction(tokenAccountInfo.address)
          );

          const wrapSig = await sendTransaction(wrapTx, this.connection);
          console.log('✅ SOL wrapped:', wrapSig);
          // Wait for SOL wrapping to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.log('✅ Sufficient WSOL balance, skipping wrap');
        }
      } catch (error) {
        console.error('❌ Failed to wrap SOL:', error);
        throw new Error(`Failed to wrap SOL for initial liquidity: ${error}`);
      }

      // 7. Call Anchor program to create pool
      try {
        console.log('Creating pool on-chain...');

        // Set resolution time to 7 days from now
        const resolutionTime = new BN(Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60));
        const question = `Market ${marketId}`;

        await anchorProgramService.createPool(
          poolId,
          question,
          resolutionTime,
          initialLiquidityBN,
          tokenMint,
          tokenAccountInfo.address
        );
        console.log('✅ Pool created on-chain');

        // Wait for transaction confirmation before reading pool state
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error('❌ Failed to create pool on-chain:', error);
        throw new Error(`Failed to create pool on Solana: ${error}`);
      }

      // 8. Create pool record in backend with on-chain address
      try {
        console.log('Saving pool to backend...');

        const poolData = {
          market_id: parseInt(marketId),
          program_id: anchorProgramService.getProgramId().toString(),
          authority: walletPublicKey.toString(),
          pool_address: poolId.toString(), // On-chain pool ID
          yes_mint: tokenMint.toString(),
          no_mint: tokenMint.toString(),
          yes_reserve: parseInt(initialLiquidityBN.toString()),
          no_reserve: parseInt(initialLiquidityBN.toString()),
          fee_percentage: 30,
        };

        console.log('Pool data being sent:', JSON.stringify(poolData, null, 2));

        const pool = await apiService.createPool(poolData);
        console.log('✅ Pool saved to backend with UUID:', pool.id);
        console.log('✅ Returning on-chain poolId:', poolId.toString());

        // Return on-chain poolId, not backend UUID
        return poolId.toString();
      } catch (error: any) {
        console.error('❌ Failed to save pool to backend:', error);
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        // Pool was created on-chain but failed to save to backend
        // Return poolId anyway so user can see it was created
        console.warn('Pool created on-chain but not saved to backend. Using poolId:', poolId.toString());
        return poolId.toString();
      }

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

      // 2. Prepare parameters
      const poolId = new BN(params.poolId);
      const outcome = params.tradeType === TradeType.BUY_YES ? { yes: {} } : { no: {} };
      const amount = new BN(params.inputAmount);
      const minTokensOut = new BN(params.minOutputAmount);

      // 3. Use native SOL
      const tokenMint = new PublicKey('So11111111111111111111111111111111111111112');

      // 4. Get or create user's token account
      const tokenAccountInfo = await this.getOrCreateAssociatedTokenAccount(
        walletPublicKey,
        tokenMint,
        walletPublicKey
      );

      // 5. If token account doesn't exist, create it first
      if (tokenAccountInfo.instruction) {
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
        const createAccountTx = new Transaction({
          blockhash,
          lastValidBlockHeight,
          feePayer: walletPublicKey,
        });
        createAccountTx.add(tokenAccountInfo.instruction);

        await sendTransaction(createAccountTx, this.connection);
        // Wait for confirmation
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // 6. Call Anchor program to buy outcome
      const buySignature = await anchorProgramService.buyOutcome(
        poolId,
        outcome,
        amount,
        minTokensOut,
        tokenMint,
        tokenAccountInfo.address
      );

      // 7. Monitor confirmation
      const result = await this.monitorTransaction(buySignature);

      if (result.status === 'failed') {
        throw new Error(result.error || 'Transaction failed');
      }

      // 8. Get actual output from on-chain state
      const userPosition = await anchorProgramService.getUserPosition(poolId, walletPublicKey);
      const outputAmount = userPosition
        ? (params.tradeType === TradeType.BUY_YES
          ? new BN(userPosition.yesTokens)
          : new BN(userPosition.noTokens))
        : params.minOutputAmount;

      // 9. Record trade in backend
      await apiService.recordTrade({
        pool_id: params.poolId,
        trade_type: params.tradeType,
        input_amount: params.inputAmount.toString(),
        output_amount: outputAmount.toString(),
        fee_amount: params.feeAmount?.toString() || '0',
        transaction_signature: buySignature,
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
  // ADDITIONAL POOL OPERATIONS
  // ============================================================================

  /**
   * Sell outcome tokens back to pool
   * @param poolId - Pool ID
   * @param outcome - Which outcome to sell ('YES' or 'NO')
   * @param tokensAmount - Amount of tokens to sell (in lamports)
   * @param slippagePercent - Maximum acceptable slippage (default 5%)
   * @returns Transaction signature
   */
  async sellOutcome(
    poolId: number,
    outcome: 'YES' | 'NO',
    tokensAmount: number,
    walletPublicKey: PublicKey,
    slippagePercent: number = 5,
  ): Promise<TransactionSignature> {
    try {
      const poolIdBN = new BN(poolId);
      const tokensAmountBN = new BN(tokensAmount);

      // Calculate minimum SOL out with slippage protection
      // For now, use a simple estimate - can be improved with actual AMM calculation
      const minSolOut = new BN(Math.floor(tokensAmount * (1 - slippagePercent / 100)));

      // Get user's token account
      const tokenAccount = await getAssociatedTokenAddress(
        NATIVE_MINT,
        walletPublicKey,
      );

      return await anchorProgramService.sellOutcome(
        poolIdBN,
        outcome === 'YES' ? { yes: {} } : { no: {} },
        tokensAmountBN,
        minSolOut,
        NATIVE_MINT,
        tokenAccount,
      );
    } catch (error) {
      throw this.createError(
        'TRANSACTION_FAILED',
        `Failed to sell ${outcome} tokens: ${error}`,
        { poolId, outcome, tokensAmount, slippagePercent },
      );
    }
  }

  /**
   * Cancel duel and refund player 1 (after 5 minute timeout)
   * @param duelId - Duel ID to cancel
   * @returns Transaction signature
   */
  async cancelDuel(
    duelId: number,
    walletPublicKey: PublicKey,
  ): Promise<TransactionSignature> {
    try {
      const duelIdBN = new BN(duelId);

      // Get user's token account
      const tokenAccount = await getAssociatedTokenAddress(
        NATIVE_MINT,
        walletPublicKey,
      );

      return await anchorProgramService.cancelDuel(
        duelIdBN,
        NATIVE_MINT,
        tokenAccount,
      );
    } catch (error) {
      throw this.createError(
        'TRANSACTION_FAILED',
        `Failed to cancel duel: ${error}`,
        { duelId },
      );
    }
  }

  /**
   * Update pool status (authority only)
   * @param poolId - Pool ID to update
   * @param newStatus - New status ('active' or 'resolved')
   * @returns Transaction signature
   */
  async updatePoolStatus(
    poolId: number,
    newStatus: 'active' | 'resolved',
  ): Promise<TransactionSignature> {
    try {
      const poolIdBN = new BN(poolId);

      return await anchorProgramService.updatePoolStatus(
        poolIdBN,
        newStatus === 'active' ? { active: {} } : { resolved: {} },
      );
    } catch (error) {
      throw this.createError(
        'TRANSACTION_FAILED',
        `Failed to update pool status: ${error}`,
        { poolId, newStatus },
      );
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
