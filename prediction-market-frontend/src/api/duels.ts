import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type {
  Duel,
  DuelResult,
  TransactionConfirmation,
  CreateDuelRequest,
  JoinDuelRequest,
  AvailableDuelsResponse,
  PriceCandlesResponse,
  DuelApiResponse,
} from '../types/duel';

export class DuelApiService {
  private api: AxiosInstance;

  constructor(
    baseURL: string = import.meta.env.VITE_API_URL || 'http://localhost:8080',
  ) {
    this.api = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token and ngrok header to requests
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      config.headers['ngrok-skip-browser-warning'] = 'true';
      return config;
    });
  }

  // ========================================================================
  // Duel Management
  // ========================================================================

  async createDuel(data: CreateDuelRequest): Promise<Duel> {
    const response = await this.api.post<DuelApiResponse<Duel>>(
      '/api/duels/create',
      {
        bet_amount: data.betAmount,
        currency: data.currency,
        market_id: data.marketId,
        event_id: data.eventId,
        predicted_outcome: data.predictedOutcome,
      },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create duel');
    }
    return this.mapDuel(response.data.data);
  }

  async getAvailableDuels(
    limit: number = 20,
    offset: number = 0,
  ): Promise<AvailableDuelsResponse> {
    const response = await this.api.get<
      DuelApiResponse<AvailableDuelsResponse>
    >('/api/duels/available', { params: { limit, offset } });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get available duels');
    }
    const result = response.data.data;
    return {
      ...result,
      duels: result.duels.map((d) => this.mapDuel(d)),
    };
  }

  async joinDuel(data: JoinDuelRequest): Promise<Duel> {
    const response = await this.api.post<DuelApiResponse<Duel>>(
      `/api/duels/${data.duelId}/join`,
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to join duel');
    }
    return this.mapDuel(response.data.data);
  }

  async getDuel(duelId: string): Promise<Duel> {
    const response = await this.api.get<DuelApiResponse<Duel>>(
      `/api/duels/${duelId}`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get duel');
    }
    return this.mapDuel(response.data.data);
  }

  async getUserDuels(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<AvailableDuelsResponse> {
    const response = await this.api.get<
      DuelApiResponse<AvailableDuelsResponse>
    >(`/api/duels/user/${userId}`, { params: { limit, offset } });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get user duels');
    }
    const result = response.data.data;
    return {
      ...result,
      duels: result.duels.map((d) => this.mapDuel(d)),
    };
  }

  // ========================================================================
  // Price Data
  // ========================================================================

  async getPriceCandles(
    symbol: string = 'SOLUSDT',
    interval: string = '1m',
    limit: number = 60,
  ): Promise<PriceCandlesResponse> {
    const response = await this.api.get<
      DuelApiResponse<PriceCandlesResponse>
    >('/api/price/candles', { params: { symbol, interval, limit } });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get price candles');
    }
    return response.data.data;
  }

  async getCurrentPrice(
    symbol: string = 'SOLUSDT',
  ): Promise<{ price: number; symbol: string; timestamp: number }> {
    const response = await this.api.get<
      DuelApiResponse<{ price: number; symbol: string; timestamp: number }>
    >('/api/price/current', { params: { symbol } });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get current price');
    }
    return response.data.data;
  }

  async getPriceAtTime(
    symbol: string,
    timestamp: number,
  ): Promise<{ price: number }> {
    const response = await this.api.get<DuelApiResponse<{ price: number }>>(
      '/api/price/at-time',
      { params: { symbol, timestamp } },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(
        response.data.error || 'Failed to get price at time',
      );
    }
    return response.data.data;
  }

  // ========================================================================
  // Transaction Confirmation
  // ========================================================================

  async confirmDuelTransaction(data: {
    duelId: string;
    transactionHash: string;
    playerId: string;
  }): Promise<TransactionConfirmation> {
    const response = await this.api.post<
      DuelApiResponse<TransactionConfirmation>
    >('/api/duels/confirm-transaction', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(
        response.data.error || 'Failed to confirm transaction',
      );
    }
    return response.data.data;
  }

  async checkTransactionConfirmations(
    transactionHash: string,
  ): Promise<TransactionConfirmation> {
    const response = await this.api.get<
      DuelApiResponse<TransactionConfirmation>
    >(`/api/duels/confirmations/${transactionHash}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(
        response.data.error || 'Failed to check confirmations',
      );
    }
    return response.data.data;
  }

  // ========================================================================
  // Duel Resolution
  // ========================================================================

  async getDuelResult(duelId: string): Promise<DuelResult> {
    const response = await this.api.get<DuelApiResponse<DuelResult>>(
      `/api/duels/${duelId}/result`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get duel result');
    }
    return response.data.data;
  }

  async resolveDuel(data: {
    duelId: string;
    winnerId: string;
    exitPrice: number;
    transactionHash: string;
  }): Promise<DuelResult> {
    const response = await this.api.post<DuelApiResponse<DuelResult>>(
      '/api/duels/resolve',
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to resolve duel');
    }
    return response.data.data;
  }

  // ========================================================================
  // Social Sharing
  // ========================================================================

  async getShareUrl(data: {
    duelId: string;
    winnerId: string;
    amountWon: number;
    currency: number;
    loserUsername: string;
    referralCode: string;
  }): Promise<{ shareUrl: string; tweetText: string }> {
    const response = await this.api.post<
      DuelApiResponse<{ shareUrl: string; tweetText: string }>
    >('/api/duels/share/x', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get share URL');
    }
    return response.data.data;
  }

  // ========================================================================
  // Internal: Map API response to typed Duel
  // ========================================================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapDuel(raw: any): Duel {
    return {
      id: raw.id ?? raw.ID ?? '',
      duelId: raw.duel_id ?? raw.duelId ?? 0,
      player1Id: raw.player_1_id ?? raw.player1Id ?? '',
      player1Username: raw.player_1_username ?? raw.player1Username ?? '',
      player1Avatar: raw.player_1_avatar ?? raw.player1Avatar,
      player2Id: raw.player_2_id ?? raw.player2Id,
      player2Username: raw.player_2_username ?? raw.player2Username,
      player2Avatar: raw.player_2_avatar ?? raw.player2Avatar,
      betAmount: raw.bet_amount ?? raw.betAmount ?? 0,
      currency: raw.currency ?? 0,
      player1Amount: raw.player_1_amount ?? raw.player1Amount ?? 0,
      player2Amount: raw.player_2_amount ?? raw.player2Amount,
      status: raw.status ?? 0,
      winnerId: raw.winner_id ?? raw.winnerId,
      priceAtStart: raw.price_at_start ?? raw.priceAtStart,
      priceAtEnd: raw.price_at_end ?? raw.priceAtEnd,
      direction: raw.direction,
      createdAt: raw.created_at ?? raw.createdAt ?? '',
      startedAt: raw.started_at ?? raw.startedAt,
      resolvedAt: raw.resolved_at ?? raw.resolvedAt,
      expiresAt: raw.expires_at ?? raw.expiresAt,
      transactionHash: raw.transaction_hash ?? raw.transactionHash,
      confirmations: raw.confirmations,
    };
  }
}

export const duelApiService = new DuelApiService();
