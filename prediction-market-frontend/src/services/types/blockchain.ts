// Blockchain type definitions for AMM + Unified Wallet
// Note: Uses `as const` objects instead of `enum` (erasableSyntaxOnly: true)

import type { PublicKey } from '@solana/web3.js';
import type BN from 'bn.js';

// ============================================================================
// CONST-BASED ENUMS (erasableSyntaxOnly compatible)
// ============================================================================

export const TradeType = {
  BUY_YES: 0,
  BUY_NO: 1,
  SELL_YES: 2,
  SELL_NO: 3,
} as const;
export type TradeType = (typeof TradeType)[keyof typeof TradeType];

export const BlockchainErrorType = {
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_POOL: 'INVALID_POOL',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  SLIPPAGE_EXCEEDED: 'SLIPPAGE_EXCEEDED',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  CONFIRMATION_TIMEOUT: 'CONFIRMATION_TIMEOUT',
  RPC_ERROR: 'RPC_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;
export type BlockchainErrorType =
  (typeof BlockchainErrorType)[keyof typeof BlockchainErrorType];

// ============================================================================
// WALLET & ACCOUNT TYPES
// ============================================================================

export interface WalletConnection {
  publicKey: PublicKey;
  connected: boolean;
  provider: 'phantom' | 'solflare' | 'other';
  balance: number; // SOL balance
  lamports: number; // Raw lamports
}

export interface UserAccount {
  walletAddress: string;
  duelsBalance: number; // SOL reserved for duels
  ammBalance: number; // SOL reserved for AMM
  totalBalance: number; // Total SOL in wallet
  associatedTokenAccounts: Map<string, string>; // Mint -> ATA mapping
}

// ============================================================================
// AMM TYPES
// ============================================================================

export interface PoolState {
  poolId: string;
  marketId: string;
  authority: PublicKey;
  yesMint: PublicKey;
  noMint: PublicKey;
  yesReserve: BN; // In lamports
  noReserve: BN; // In lamports
  totalLiquidity: BN;
  feePercentage: number; // 0.5 = 0.5%
  bump: number;
  createdAt: number;
}

export interface TradeQuote {
  outputAmount: BN; // In lamports
  pricePerToken: number; // YES/NO token price
  slippage: number; // Percentage
  feeAmount: BN; // In lamports
  priceImpact: number; // Percentage
  minimumReceived: BN; // With slippage tolerance
}

export interface TradeParams {
  poolId: string;
  inputAmount: BN; // In lamports (SOL)
  tradeType: TradeType;
  minOutputAmount: BN; // In lamports
  expectedOutputAmount?: BN; // In lamports, estimated from quote
  feeAmount?: BN; // In lamports
  slippageTolerance?: number; // Default 0.5%
  userWallet: PublicKey;
}

export interface TransactionResult {
  signature: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  blockTime?: number;
  error?: string;
  lamportsUsed?: number; // Gas fees
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

export interface PoolAccount {
  authority: PublicKey;
  yesMint: PublicKey;
  noMint: PublicKey;
  yesReserve: BN;
  noReserve: BN;
  feePercentage: number;
  totalLiquidity: BN;
  bump: number;
}

// ============================================================================
// POSITION TYPES
// ============================================================================

export interface UserPosition {
  marketId: string;
  yesTokens: BN; // Amount of YES tokens held
  noTokens: BN; // Amount of NO tokens held
  entryPrice: number; // Average entry price
  currentValue: BN; // Current value in SOL
  unrealizedPnL: BN; // In SOL
  realizedPnL: BN; // In SOL
  createdAt: number;
}

export interface PortfolioSummary {
  totalBalance: BN; // Total SOL
  totalInvested: BN; // Total SOL invested
  totalValue: BN; // Current total value
  totalPnL: BN; // Total profit/loss
  positions: UserPosition[];
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface BlockchainError extends Error {
  type: BlockchainErrorType;
  details?: Record<string, unknown>;
}
