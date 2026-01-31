import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Duel, DuelResult } from '../types/duel';

interface DuelState {
  activeDuel: Duel | null;
  loading: boolean;
  error: string | null;
  setActiveDuel: (duel: Duel | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // New fields for game flow
  countdownValue: number;
  currentPrice: number;
  entryPrice: number | null;
  result: DuelResult | null;

  setCountdownValue: (val: number) => void;
  setCurrentPrice: (val: number) => void;
  setEntryPrice: (val: number | null) => void;
  setResult: (res: DuelResult | null) => void;
}

export const useDuelStore = create<DuelState>()(
  persist(
    (set) => ({
      activeDuel: null,
      loading: false,
      error: null,
      countdownValue: 60,
      currentPrice: 0,
      entryPrice: null,
      result: null,

      setActiveDuel: (duel) => set({ activeDuel: duel }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      setCountdownValue: (val) => set({ countdownValue: val }),
      setCurrentPrice: (val) => set({ currentPrice: val }),
      setEntryPrice: (val) => set({ entryPrice: val }),
      setResult: (res) => set({ result: res }),
    }),
    {
      name: 'duel-storage',
      partialize: (state) => ({ activeDuel: state.activeDuel }), // Only persist activeDuel
    }
  )
);
