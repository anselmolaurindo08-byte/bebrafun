import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import anchorProgramService from './anchorProgramService';

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
  getQuote(solAmount: number, outcome: 'yes' | 'no'): {
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
}

export default new BlockchainService();
