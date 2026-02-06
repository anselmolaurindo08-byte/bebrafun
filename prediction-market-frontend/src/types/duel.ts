// Ensure this file uses valid TypeScript enum syntax
export interface Duel {
  id: string;
  duelId: number;
  player1Id: string;
  player1Username?: string;
  player1Avatar?: string;
  player2Id?: string;
  player2Username?: string;
  player2Avatar?: string;
  betAmount: number;
  player1Amount: number;
  player2Amount?: number;
  marketId?: number;
  eventId?: number;
  status: DuelStatus;
  winnerId?: string;
  currency: DuelCurrency | number; // Can be string enum or int from backend
  createdAt: string;
  startingAt?: string;  // When 5-second countdown started
  startedAt?: string;   // When actual 1-min duel timer started
  resolvedAt?: string;
  expiresAt?: string;
  escrowTxHash?: string;
  resolutionTxHash?: string;
  predictedOutcome?: 'UP' | 'DOWN';
  player1Deposited?: boolean;
  player2Deposited?: boolean;

  // Legacy fields for backward compatibility if needed
  priceAtStart?: number;       // Entry price for resolution
  priceAtEnd?: number;         // Exit price for resolution
  chartStartPrice?: number;    // First WebSocket price for chart display
  direction?: number;          // 0 = UP, 1 = DOWN (matches backend int16 and contract u8) - Player 1's prediction
  player2Direction?: number;   // 0 = UP, 1 = DOWN - Player 2's prediction
  transactionHash?: string;
  confirmations?: number;      // Added missing field
}

export const DuelStatus = {
  PENDING: 'PENDING',
  MATCHED: 'MATCHED',
  STARTING: 'STARTING',  // 5-second countdown before duel starts
  ACTIVE: 'ACTIVE',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;
export type DuelStatus = (typeof DuelStatus)[keyof typeof DuelStatus];

export const DUEL_STATUS_LABELS: Record<DuelStatus, string> = {
  [DuelStatus.PENDING]: 'Waiting for Opponent',
  [DuelStatus.MATCHED]: 'Opponent Found',
  [DuelStatus.STARTING]: 'Preparing...',
  [DuelStatus.ACTIVE]: 'Live',
  [DuelStatus.RESOLVED]: 'Resolved',
  [DuelStatus.CANCELLED]: 'Cancelled',
  [DuelStatus.EXPIRED]: 'Expired',
};

export const DuelCurrency = {
  SOL: 'SOL',
  PUMP: 'PUMP',
  USDC: 'USDC',
} as const;
export type DuelCurrency = (typeof DuelCurrency)[keyof typeof DuelCurrency];

export const CURRENCY_LABELS: Record<DuelCurrency, string> = {
  [DuelCurrency.SOL]: 'SOL',
  [DuelCurrency.PUMP]: 'PUMP',
  [DuelCurrency.USDC]: 'USDC',
};

export const DIRECTION_LABELS = {
  UP: 'Higher',
  DOWN: 'Lower',
};

export interface CreateDuelRequest {
  duelId?: number; // On-chain duel ID (CRITICAL for backend sync)
  betAmount: number;
  marketId?: number; // Market ID: 1=SOL/USDC, 2=PUMP/USDC
  eventId?: string;
  currency: DuelCurrency;
  predictedOutcome?: 'UP' | 'DOWN';
  direction?: number; // 0 = UP, 1 = DOWN
  signature: string; // Transaction signature (REQUIRED)
}

export interface DuelResult {
  winnerId: string;
  winnerUsername: string;
  amountWon: number;
  currency: DuelCurrency;
  pnl: number;

  entryPrice?: number;
  exitPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  direction?: 'UP' | 'DOWN';
  durationSeconds?: number;
  winnerAvatar?: string;
  loserAvatar?: string;
  loserUsername?: string;
}

export interface DuelStatistics {
  totalDuels: number;
  wins: number;
  losses: number;
  totalVolume: number;
}

export interface TransactionConfirmation {
  signature: string;
  status: 'pending' | 'confirmed' | 'finalized' | 'failed';
  transactionHash?: string; // Alias for signature if needed
  confirmations?: number;
  timestamp?: number; // Added missing field
}

export interface JoinDuelRequest {
  duelId: string;
  signature: string; // Transaction signature (REQUIRED)
}

export interface AvailableDuelsResponse {
  duels: Duel[];
  total: number;
}

export interface PriceCandlesResponse {
  candles: PriceCandle[];
}

export interface PriceCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface DuelApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const DUEL_CONSTANTS = {
  MIN_BET: 0.01,
  MAX_BET: 100,
  FEE_PERCENT: 0.5,
  MIN_BET_AMOUNT: 0.01, // Add alias
  MAX_BET_AMOUNT: 100,  // Add alias
  REQUIRED_CONFIRMATIONS: 1, // Add missing constant
};

export interface ValidationResult {
  isValid: boolean;
  valid?: boolean; // Alias
  error?: string;
}

export interface DepositRequest {
  signature: string;
}

export type DuelFlowState = 'confirm' | 'sending' | 'confirming' | 'complete';

export interface DuelFlowStateObj {
  currentStep: DuelFlowState;
  duel: Duel | null;
  confirmations: number;
  countdownValue: number;
  currentPrice: number;
  entryPrice: number | null;
  result: DuelResult | null;
  error: string | null;
}
