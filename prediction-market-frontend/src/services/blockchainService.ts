import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import anchorProgramService from './anchorProgramService';
import { BlockchainErrorType } from './types/blockchain';

/**
 * Simplified Blockchain Service - SOL-based trading
 * 
 * Provides high-level functions for buying/selling positions with SOL
 * No token accounts, no slippage, just simple SOL transfers
 */
class BlockchainService {
  /**
   * Buy outcome shares with SOL
   */
  async buyShares(
    poolId: number,
    outcome: 'yes' | 'no',
    solAmount: number
  ): Promise<{ success: boolean; tx?: string; error?: string }> {
    try {
      const poolIdBN = new BN(poolId);
      const solAmountBN = new BN(solAmount * 1e9); // Convert to lamports
      const outcomeEnum = outcome === 'yes' ? { yes: {} } : { no: {} };

      const tx = await anchorProgramService.buyOutcome(
        poolIdBN,
        outcomeEnum,
        solAmountBN
      );

      return { success: true, tx };
    } catch (error: any) {
      console.error('Buy shares error:', error);
      return {
        success: false,
        error: error.message || 'Failed to buy shares'
      };
    }
  }

  /**
   * Sell outcome shares for SOL
   */
  async sellShares(
    poolId: number,
    outcome: 'yes' | 'no',
    sharesAmount: number
  ): Promise<{ success: boolean; tx?: string; error?: string }> {
    try {
      const poolIdBN = new BN(poolId);
      const sharesAmountBN = new BN(sharesAmount);
      const outcomeEnum = outcome === 'yes' ? { yes: {} } : { no: {} };

      const tx = await anchorProgramService.sellOutcome(
        poolIdBN,
        outcomeEnum,
        sharesAmountBN
      );

      return { success: true, tx };
    } catch (error: any) {
      console.error('Sell shares error:', error);
      return {
        success: false,
        error: error.message || 'Failed to sell shares'
      };
    }
  }

  /**
   * Get pool state
   */
  async getPool(poolId: number): Promise<any> {
    try {
      const poolIdBN = new BN(poolId);
      return await anchorProgramService.getPool(poolIdBN);
    } catch (error) {
      console.error('Get pool error:', error);
      return null;
    }
  }

  /**
   * Get user position
   */
  async getUserPosition(poolId: number, userAddress: string): Promise<any> {
    try {
      const poolIdBN = new BN(poolId);
      const userPubkey = new PublicKey(userAddress);
      return await anchorProgramService.getUserPosition(poolIdBN, userPubkey);
    } catch (error) {
      console.error('Get user position error:', error);
      return null;
    }
  }

  /**
   * Calculate quote for buying shares
   * Simple estimation: shares ≈ SOL amount (1:1 for now)
   */
  getQuote(solAmount: number, _outcome: 'yes' | 'no'): {
    estimatedShares: number;
    pricePerShare: number;
  } {
    // TODO: Implement proper AMM pricing formula
    // For now, simple 1:1
    return {
      estimatedShares: solAmount,
      pricePerShare: 1
    };
  }

  // ============================================================================
  // DUEL OPERATIONS
  // ============================================================================

  /**
   * Initialize a new duel with SOL
   */
  async initializeDuel(
    duelId: number,
    amount: number,
    predictedOutcome: number
  ): Promise<{ success: boolean; tx?: string; error?: string }> {
    try {
      const duelIdBN = new BN(duelId);
      const amountBN = new BN(amount * 1e9); // Convert to lamports

      const tx = await anchorProgramService.initializeDuel(
        duelIdBN,
        amountBN,
        predictedOutcome
      );

      return { success: true, tx };
    } catch (error: any) {
      console.error('Initialize duel error:', error);
      return {
        success: false,
        error: error.message || 'Failed to initialize duel'
      };
    }
  }

  /**
   * Join an existing duel with SOL
   */
  async joinDuel(
    duelId: number,
    predictedOutcome: number
  ): Promise<{ success: boolean; tx?: string; error?: string }> {
    try {
      const duelIdBN = new BN(duelId);

      const tx = await anchorProgramService.joinDuel(
        duelIdBN,
        predictedOutcome
      );

      return { success: true, tx };
    } catch (error: any) {
      console.error('Join duel error:', error);
      return {
        success: false,
        error: error.message || 'Failed to join duel'
      };
    }
  }

  /**
   * Cancel duel and get refund (player 1 only, after timeout)
   */
  async cancelDuel(
    duelId: number
  ): Promise<{ success: boolean; tx?: string; error?: string }> {
    try {
      const duelIdBN = new BN(duelId);

      const tx = await anchorProgramService.cancelDuel(duelIdBN);

      return { success: true, tx };
    } catch (error: any) {
      console.error('Cancel duel error:', error);
      return {
        success: false,
        error: error.message || 'Failed to cancel duel'
      };
    }
  }

  /**
   * Resolve duel and pay out winner (authority only)
   */
  async resolveDuel(
    duelId: number,
    exitPrice: number
  ): Promise<{ success: boolean; tx?: string; error?: string }> {
    try {
      const duelIdBN = new BN(duelId);
      const exitPriceBN = new BN(exitPrice);

      const tx = await anchorProgramService.resolveDuel(
        duelIdBN,
        exitPriceBN
      );

      return { success: true, tx };
    } catch (error: any) {
      console.error('Resolve duel error:', error);
      return {
        success: false,
        error: error.message || 'Failed to resolve duel'
      };
    }
  }

  /**
   * Get Solana connection
   */
  getConnection() {
    return anchorProgramService.getProgram().provider.connection;
  }

  // ============================================================================
  // COMPATIBILITY METHODS (for hooks)
  // ============================================================================

  /**
   * Create standardized error object
   */
  createError(type: BlockchainErrorType, message: string): { type: BlockchainErrorType; message: string; name: string } {
    return { type, message, name: 'BlockchainError' };
  }

  /**
   * Get pool state (alias for getPool)
   */
  async getPoolState(poolId: string): Promise<any> {
    return this.getPool(parseInt(poolId));
  }

  /**
   * Get pool by market ID - fetches from backend API
   */
  async getPoolByMarketId(marketId: string): Promise<any> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/amm/pools/market/${marketId}`);
      if (!response.ok) {
        console.warn(`Pool not found for market ${marketId}`);
        return null;
      }
      const pool = await response.json();
      return pool;
    } catch (error) {
      console.error('Error fetching pool by market ID:', error);
      return null;
    }
  }

  /**
   * Calculate trade quote (simplified version)
   */
  calculateTradeQuote(
    _poolState: any,
    inputAmount: any,
    tradeType: any,
    slippageTolerance: number
  ): any {
    const solAmount = inputAmount.toNumber() / 1e9;
    const quote = this.getQuote(solAmount, tradeType === 0 ? 'yes' : 'no');

    return {
      outputAmount: new BN(quote.estimatedShares * 1e9),
      minimumReceived: new BN(quote.estimatedShares * (1 - slippageTolerance / 100) * 1e9),
      feeAmount: new BN(quote.estimatedShares * 0.003 * 1e9),
      priceImpact: 0,
      slippageTolerance
    };
  }

  /**
   * Execute trade (wrapper for buyShares/sellShares)
   */
  async executeTrade(
    params: {
      poolId: string;
      inputAmount: any;
      tradeType: any;
      minOutputAmount?: any;
      expectedOutputAmount?: any;
      feeAmount?: any;
      slippageTolerance?: number;
      userWallet: any;
    },
    _publicKey: any,
    _sendTransaction: any
  ): Promise<any> {
    const solAmount = params.inputAmount.toNumber() / 1e9;
    const outcome = params.tradeType === 0 ? 'yes' : 'no';

    const result = await this.buyShares(
      parseInt(params.poolId),
      outcome,
      solAmount
    );

    if (result.success) {
      return {
        signature: result.tx,
        status: 'confirmed',
        confirmations: 1
      };
    } else {
      throw new Error(result.error || 'Trade failed');
    }
  }

  /**
   * Get user account - In SOL-based system, user accounts are not stored on-chain
   * Returns a minimal object for compatibility
   */
  async getUserAccount(_publicKey: any): Promise<any> {
    // In the SOL-based system, we don't have on-chain user accounts
    // User positions are tracked in the backend database
    return {
      publicKey: _publicKey?.toString() || '',
      positions: []
    };
  }

  /**
   * Create pool (wrapper for anchorProgramService)
   */
  async createPool(
    poolId: number,
    marketId: number,
    initialLiquidity: number
  ): Promise<{ success: boolean; tx?: string; error?: string }> {
    try {
      const poolIdBN = new BN(poolId);
      const marketIdBN = new BN(marketId);
      const liquidityBN = new BN(initialLiquidity * 1e9);

      // Create pool on-chain
      const tx = await anchorProgramService.createPool(
        poolIdBN,
        marketIdBN,
        liquidityBN
      );

      // Get pool PDA address
      const [poolPda] = anchorProgramService.getPoolPda(poolIdBN);
      const program = anchorProgramService.getProgram();
      const authority = program.provider.publicKey;

      if (!authority) {
        throw new Error('Wallet not connected');
      }

      // Persist pool data to backend
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/amm/pools`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            market_id: marketId,
            program_id: program.programId.toString(),
            authority: authority.toString(),
            pool_address: poolPda.toString(),
            yes_mint: 'native', // SOL-based system uses native SOL
            no_mint: 'native',
            yes_reserve: initialLiquidity,
            no_reserve: initialLiquidity,
            fee_percentage: 30, // 0.3% fee (30 basis points)
          }),
        });

        if (!response.ok) {
          console.error('Failed to persist pool to backend:', await response.text());
          // Don't fail the whole operation if backend persistence fails
        } else {
          console.log('✅ Pool persisted to backend database');
        }
      } catch (backendError) {
        console.error('Backend persistence error:', backendError);
        // Don't fail the whole operation if backend persistence fails
      }

      return { success: true, tx };
    } catch (error: any) {
      console.error('Create pool error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create pool'
      };
    }
  }
}

export default new BlockchainService();
