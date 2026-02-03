import api from './api';
import type {
  Duel,
  DuelStatistics,
  CreateDuelRequest,
  DepositRequest,
} from '../types/duel';
import { PublicKey, Connection, Transaction } from '@solana/web3.js';
import BN from 'bn.js';
import anchorProgramService from './anchorProgramService';
import { getAssociatedTokenAddress } from '@solana/spl-token';

// Map snake_case API response to camelCase Duel
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDuel(raw: any): Duel {
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

export const duelService = {
  createDuel: async (
    request: CreateDuelRequest,
    walletPublicKey: PublicKey,
    sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>
  ): Promise<Duel> => {
    // 1. Generate duel ID from timestamp
    const duelId = new BN(Date.now());

    // 2. Prepare parameters
    const betAmount = new BN(request.betAmount);
    const tokenMint = new PublicKey('So11111111111111111111111111111111111111112'); // Native SOL

    // 3. Get or create user's token account
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      walletPublicKey
    );

    // 4. Call Anchor program to initialize duel
    const signature = await anchorProgramService.initializeDuel(
      duelId,
      betAmount,
      tokenMint,
      userTokenAccount
    );

    // 5. Get duel PDA for backend storage
    const [duelPda] = anchorProgramService.getDuelPda(duelId);

    // 6. Create duel record in backend with on-chain address
    const raw = await api.createDuel({
      bet_amount: request.betAmount,
      market_id: request.marketId,
      event_id: request.eventId,
      predicted_outcome: request.predictedOutcome,
      currency: request.currency,
      signature: signature,
      duel_address: duelPda.toString(), // Store on-chain address
    });
    return mapDuel(raw);
  },

  getDuel: async (duelId: string): Promise<Duel> => {
    const raw = await api.getDuel(duelId);
    return mapDuel(raw);
  },

  getPlayerDuels: async (
    limit = 20,
    offset = 0,
  ): Promise<{ duels: Duel[]; total: number }> => {
    const result = await api.getPlayerDuels(limit, offset);
    return {
      duels: (result.duels || []).map(mapDuel),
      total: result.total,
    };
  },

  getPlayerStatistics: async (): Promise<DuelStatistics> => {
    return await api.getPlayerStatistics();
  },

  depositToDuel: async (
    duelId: string,
    request: DepositRequest,
  ): Promise<void> => {
    await api.depositToDuel(duelId, request);
  },

  cancelDuel: async (duelId: string): Promise<void> => {
    await api.cancelDuel(duelId);
  },

  joinDuel: async (
    duelId: string,
    walletPublicKey: PublicKey,
    sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>
  ): Promise<Duel> => {
    // 1. Convert duel ID to BN
    const duelIdBN = new BN(duelId);

    // 2. Prepare parameters
    const tokenMint = new PublicKey('So11111111111111111111111111111111111111112'); // Native SOL

    // 3. Get user's token account
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      walletPublicKey
    );

    // 4. Call Anchor program to join duel
    const signature = await anchorProgramService.joinDuel(
      duelIdBN,
      tokenMint,
      userTokenAccount
    );

    // 5. Update backend with join transaction
    const raw = await api.joinDuel(duelId, { signature });
    return mapDuel(raw);
  },

  resolveDuel: async (
    duelId: string,
    winnerId: string,
    winnerAmount: number,
  ): Promise<void> => {
    await api.resolveDuel(duelId, winnerId, winnerAmount);
  },

  getActiveDuels: async (
    limit = 50,
  ): Promise<{ duels: Duel[]; total: number }> => {
    const result = await api.getActiveDuels(limit);
    return {
      duels: (result.duels || []).map(mapDuel),
      total: result.total,
    };
  },

  getConfig: async (): Promise<{ serverWallet: string; network: string }> => {
    const response = await api.getDuelConfig();
    return response;
  },
};

