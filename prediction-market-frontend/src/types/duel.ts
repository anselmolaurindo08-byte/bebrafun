export interface Duel {
  id: string;
  duel_id: number;
  player_1_id: string;
  player_2_id?: string;
  bet_amount: number;
  player_1_amount: number;
  player_2_amount?: number;
  status: DuelStatus;
  winner_id?: string;
  created_at: string;
  started_at?: string;
  resolved_at?: string;
  expires_at?: string;
}

export interface PlayerInfo {
  id: string;
  username: string;
  avatar: string;
  walletAddress?: string;
}

export type DuelStatus =
  | 'PENDING'
  | 'MATCHED'
  | 'ACTIVE'
  | 'RESOLVED'
  | 'CANCELLED'
  | 'EXPIRED';

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

export interface CreateDuelRequest {
  bet_amount: number;
  market_id?: string;
  event_id?: string;
  predicted_outcome?: string;
}

export interface DepositRequest {
  signature: string;
}
