import api from './api';
import type { Duel, DuelStatistics, CreateDuelRequest, DepositRequest } from '../types/duel';

export const duelService = {
  // Create a new duel
  createDuel: async (request: CreateDuelRequest): Promise<Duel> => {
    return await api.createDuel(request);
  },

  // Get duel by ID
  getDuel: async (duelId: string): Promise<Duel> => {
    return await api.getDuel(duelId);
  },

  // Get player's duels
  getPlayerDuels: async (limit = 20, offset = 0): Promise<{ duels: Duel[]; total: number }> => {
    return await api.getPlayerDuels(limit, offset);
  },

  // Get player statistics
  getPlayerStatistics: async (): Promise<DuelStatistics> => {
    return await api.getPlayerStatistics();
  },

  // Deposit to duel (send transaction signature)
  depositToDuel: async (duelId: string, request: DepositRequest): Promise<void> => {
    await api.depositToDuel(duelId, request);
  },

  // Cancel duel
  cancelDuel: async (duelId: string): Promise<void> => {
    await api.cancelDuel(duelId);
  },

  // Join duel
  joinDuel: async (duelId: string): Promise<Duel> => {
    return await api.joinDuel(duelId);
  },

  // Resolve duel (admin only)
  resolveDuel: async (duelId: string, winnerId: string, winnerAmount: number): Promise<void> => {
    await api.resolveDuel(duelId, winnerId, winnerAmount);
  },

  // Get active duels (admin only)
  getActiveDuels: async (limit = 50): Promise<{ duels: Duel[]; total: number }> => {
    return await api.getActiveDuels(limit);
  },
};
