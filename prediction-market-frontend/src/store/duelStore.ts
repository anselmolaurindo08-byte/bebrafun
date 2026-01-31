import { create } from 'zustand';
import type {
  Duel,
  DuelResult,
  DuelStatistics,
  PriceCandle,
  DuelFlowState,
} from '../types/duel';

interface DuelStoreState {
  // Current active duel
  activeDuel: Duel | null;

  // Available duels from other players
  availableDuels: Duel[];

  // User's duels (replaces old playerDuels)
  userDuels: Duel[];

  // Player statistics (backward compat)
  statistics: DuelStatistics | null;

  // Price data
  priceCandles: PriceCandle[];
  currentPrice: number;
  entryPrice: number | null;

  // Duel state
  confirmations: number;
  countdownValue: number;
  duelResult: DuelResult | null;

  // UI state
  loading: boolean;
  error: string | null;
  flowState: DuelFlowState;

  // Actions
  setActiveDuel: (duel: Duel | null) => void;
  setAvailableDuels: (duels: Duel[]) => void;
  setUserDuels: (duels: Duel[]) => void;
  setStatistics: (stats: DuelStatistics | null) => void;
  setPriceCandles: (candles: PriceCandle[]) => void;
  setCurrentPrice: (price: number) => void;
  setEntryPrice: (price: number) => void;
  setConfirmations: (count: number) => void;
  setCountdownValue: (value: number) => void;
  setDuelResult: (result: DuelResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFlowState: (state: Partial<DuelFlowState>) => void;
  updateDuelStatus: (duelId: string, status: number) => void;
  clearError: () => void;
  reset: () => void;
}

const initialFlowState: DuelFlowState = {
  currentStep: 'create',
  duel: null,
  confirmations: 0,
  countdownValue: 3,
  currentPrice: 0,
  entryPrice: null,
  result: null,
  error: null,
};

export const useDuelStore = create<DuelStoreState>((set) => ({
  activeDuel: null,
  availableDuels: [],
  userDuels: [],
  statistics: null,
  priceCandles: [],
  currentPrice: 0,
  entryPrice: null,
  confirmations: 0,
  countdownValue: 3,
  duelResult: null,
  loading: false,
  error: null,
  flowState: initialFlowState,

  setActiveDuel: (duel) => set({ activeDuel: duel }),
  setAvailableDuels: (duels) => set({ availableDuels: duels }),
  setUserDuels: (duels) => set({ userDuels: duels }),
  setStatistics: (stats) => set({ statistics: stats }),
  setPriceCandles: (candles) => set({ priceCandles: candles }),
  setCurrentPrice: (price) => set({ currentPrice: price }),
  setEntryPrice: (price) => set({ entryPrice: price }),
  setConfirmations: (count) => set({ confirmations: count }),
  setCountdownValue: (value) => set({ countdownValue: value }),
  setDuelResult: (result) => set({ duelResult: result }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setFlowState: (state) =>
    set((prev) => ({
      flowState: { ...prev.flowState, ...state },
    })),

  updateDuelStatus: (duelId, status) =>
    set((state) => ({
      userDuels: state.userDuels.map((d) =>
        d.id === duelId
          ? { ...d, status: status as Duel['status'] }
          : d,
      ),
    })),

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      activeDuel: null,
      availableDuels: [],
      userDuels: [],
      statistics: null,
      priceCandles: [],
      currentPrice: 0,
      entryPrice: null,
      confirmations: 0,
      countdownValue: 3,
      duelResult: null,
      loading: false,
      error: null,
      flowState: initialFlowState,
    }),
}));
