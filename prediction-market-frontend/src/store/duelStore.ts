import { create } from 'zustand';
import type { Duel, DuelStatistics } from '../types/duel';

interface DuelStore {
  // State
  activeDuel: Duel | null;
  playerDuels: Duel[];
  statistics: DuelStatistics | null;
  loading: boolean;
  error: string | null;

  // Actions
  setActiveDuel: (duel: Duel | null) => void;
  setPlayerDuels: (duels: Duel[]) => void;
  setStatistics: (stats: DuelStatistics | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateDuelStatus: (duelId: string, status: string) => void;
  clearError: () => void;
}

export const useDuelStore = create<DuelStore>((set) => ({
  activeDuel: null,
  playerDuels: [],
  statistics: null,
  loading: false,
  error: null,

  setActiveDuel: (duel) => set({ activeDuel: duel }),
  setPlayerDuels: (duels) => set({ playerDuels: duels }),
  setStatistics: (stats) => set({ statistics: stats }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  updateDuelStatus: (duelId, status) =>
    set((state) => ({
      playerDuels: state.playerDuels.map((d) =>
        d.id === duelId ? { ...d, status: status as any } : d
      ),
    })),

  clearError: () => set({ error: null }),
}));
