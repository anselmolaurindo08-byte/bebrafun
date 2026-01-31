import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  clusterApiUrl,
} from '@solana/web3.js';
import type { TransactionSignature } from '@solana/web3.js';
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
  private confirmationTarget: number = 6;

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
  // AMM POOL STATE
  // ============================================================================

  async getPoolState(poolId: string): Promise<PoolState> {
    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiUrl}/api/amm/pools/${poolId}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const pool = json.data;

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
      const apiUrl =
        import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${apiUrl}/api/amm/pools?market_id=${marketId}`,
        { headers },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const pools = json.data;

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
  // TRADE EXECUTION (Phase 2 - placeholder)
  // ============================================================================

  async executeTrade(
    _params: TradeParams,
    _walletPublicKey: PublicKey,
  ): Promise<TransactionResult> {
    // Phase 2: Build and send actual Solana transaction
    // 1. Build transaction with Anchor program instruction
    // 2. Request wallet signature via signTransaction
    // 3. Send signed transaction to blockchain
    // 4. Monitor confirmations

    return {
      signature: 'placeholder_' + Date.now(),
      status: 'pending',
      confirmations: 0,
      error: 'Trade execution not yet implemented. Coming in Phase 2.',
    };
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

        if (status.value?.confirmationStatus === 'finalized') {
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
        return {
          signature,
          status: 'failed',
          confirmations,
          error: 'Transaction confirmation timeout',
        };
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
