// Duel type definitions (enhanced)
// Note: Uses `as const` objects instead of `enum` (erasableSyntaxOnly: true)

import type BN from 'bn.js';

// ============================================================================
// CONST-BASED ENUMS (erasableSyntaxOnly compatible)
// ============================================================================

export const DuelCurrency = {
  SOL: 0,
  PUMP: 1,
} as const;
export type DuelCurrency = (typeof DuelCurrency)[keyof typeof DuelCurrency];

export const DuelStatus = {
  PENDING: 0,
  MATCHED: 1,
  WAITING_DEPOSIT: 2,
  CONFIRMING_TRANSACTIONS: 3,
  COUNTDOWN: 4,
  ACTIVE: 5,
  FINISHED: 6,
  RESOLVED: 7,
  CANCELLED: 8,
  EXPIRED: 9,
} as const;
export type DuelStatus = (typeof DuelStatus)[keyof typeof DuelStatus];

export const TradeDirection = {
  UP: 0,
  DOWN: 1,
} as const;
export type TradeDirection =
  (typeof TradeDirection)[keyof typeof TradeDirection];

// ============================================================================
// Core Data Types
// ============================================================================

export interface Duel {
  id: string;
  duelId: number;
  player1Id: string;
  player1Username: string;
  player1Avatar?: string;
  player2Id?: string;
  player2Username?: string;
  player2Avatar?: string;
  betAmount: number;
  currency: DuelCurrency;
  player1Amount: number;
  player2Amount?: number;
  status: DuelStatus;
  winnerId?: string;
  priceAtStart?: number;
  priceAtEnd?: number;
  direction?: TradeDirection;
  createdAt: string;
  startedAt?: string;
  resolvedAt?: string;
  expiresAt?: string;
  transactionHash?: string;
  confirmations?: number;
}

export interface PriceCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DuelResult {
  duelId: string;
  winnerId: string;
  loserId: string;
  winnerUsername: string;
  loserUsername: string;
  winnerAvatar?: string;
  loserAvatar?: string;
  amountWon: number;
  currency: DuelCurrency;
  entryPrice: number;
  exitPrice: number;
  priceChange: number;
  priceChangePercent: number;
  direction: TradeDirection;
  wasCorrect: boolean;
  durationSeconds: number;
}

export interface TransactionConfirmation {
  transactionHash: string;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
}

export interface CreateDuelRequest {
  betAmount: number;
  currency: DuelCurrency;
  marketId?: string;
  eventId?: string;
  predictedOutcome?: string;
}

export interface JoinDuelRequest {
  duelId: string;
  playerId: string;
  playerUsername: string;
  playerAvatar?: string;
}

export interface DuelDepositRequest {
  duelId: string;
  playerId: string;
  amount: number;
  currency: DuelCurrency;
  transactionHash: string;
}

export interface UserPosition {
  playerId: string;
  duelId: string;
  betAmount: number;
  currency: DuelCurrency;
  direction: TradeDirection;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface DuelApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AvailableDuelsResponse {
  duels: Duel[];
  total: number;
  limit: number;
  offset: number;
}

export interface PriceCandlesResponse {
  candles: PriceCandle[];
  symbol: string;
  interval: string;
}

export interface CurrentPriceResponse {
  price: number;
  symbol: string;
  timestamp: number;
}

// ============================================================================
// Blockchain Types
// ============================================================================

export interface DuelAccount {
  duelId: number;
  player1: string;
  player2: string;
  betAmount: BN;
  currency: number;
  status: number;
  direction: number;
  priceAtStart: BN;
  priceAtEnd: BN;
  winnerId: string;
  createdAt: number;
  startedAt: number;
  resolvedAt: number;
  confirmations: number;
  bump: number;
}

export interface DepositAccount {
  duelId: number;
  playerId: string;
  amount: BN;
  currency: number;
  status: number;
  transactionHash: string;
  confirmations: number;
  timestamp: number;
  bump: number;
}

// ============================================================================
// Validation & Utility Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface DuelFlowState {
  currentStep:
    | 'create'
    | 'join'
    | 'deposit'
    | 'confirm'
    | 'countdown'
    | 'active'
    | 'finish';
  duel: Duel | null;
  confirmations: number;
  countdownValue: number;
  currentPrice: number;
  entryPrice: number | null;
  result: DuelResult | null;
  error: string | null;
}

// ============================================================================
// Constants
// ============================================================================

export const DUEL_CONSTANTS = {
  MIN_BET_AMOUNT: 0.001,
  MAX_BET_AMOUNT: 1000,
  DUEL_DURATION_SECONDS: 60,
  REQUIRED_CONFIRMATIONS: 6,
  COUNTDOWN_DURATION: 3,
  PRICE_UPDATE_INTERVAL: 1000,
  DUEL_EXPIRY_HOURS: 24,
  TRANSACTION_TIMEOUT_MS: 60000,
} as const;

export const DUEL_STATUS_LABELS: Record<DuelStatus, string> = {
  [DuelStatus.PENDING]: 'Waiting for opponent',
  [DuelStatus.MATCHED]: 'Opponent found',
  [DuelStatus.WAITING_DEPOSIT]: 'Waiting for deposits',
  [DuelStatus.CONFIRMING_TRANSACTIONS]: 'Confirming transactions',
  [DuelStatus.COUNTDOWN]: 'Starting in 3... 2... 1...',
  [DuelStatus.ACTIVE]: 'Price tracking in progress',
  [DuelStatus.FINISHED]: 'Duel finished',
  [DuelStatus.RESOLVED]: 'Results confirmed',
  [DuelStatus.CANCELLED]: 'Cancelled',
  [DuelStatus.EXPIRED]: 'Expired',
};

export const CURRENCY_LABELS: Record<DuelCurrency, string> = {
  [DuelCurrency.SOL]: 'SOL',
  [DuelCurrency.PUMP]: '$PUMP',
};

export const DIRECTION_LABELS: Record<TradeDirection, string> = {
  [TradeDirection.UP]: 'UP',
  [TradeDirection.DOWN]: 'DOWN',
};

// ============================================================================
// BACKWARD-COMPATIBLE TYPES (used by existing components)
// ============================================================================

export interface DuelStatistics {
  id: string;
  user_id: string;
  total_duels: number;
  wins: number;
  losses: number;
  total_wagered: number;
  total_won: number;
  total_lost: number;
  win_rate: number;
  avg_bet: number;
  updated_at: string;
}

export interface PlayerInfo {
  id: string;
  username: string;
  avatar: string;
  walletAddress?: string;
}

export interface DepositRequest {
  signature: string;
}
