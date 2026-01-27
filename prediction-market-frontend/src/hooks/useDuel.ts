import { useEffect, useState } from 'react';
import { duelService } from '../services/duelService';
import { useDuelStore } from '../store/duelStore';
import type { DuelStatistics } from '../types/duel';

export const useDuel = () => {
  const { activeDuel, setActiveDuel, setLoading, setError } = useDuelStore();
  const [refreshInterval, setRefreshInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // Fetch duel by ID
  const fetchDuel = async (duelId: string) => {
    try {
      setLoading(true);
      const duel = await duelService.getDuel(duelId);
      setActiveDuel(duel);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch duel');
    } finally {
      setLoading(false);
    }
  };

  // Fetch player statistics
  const fetchStatistics = async (): Promise<DuelStatistics | null> => {
    try {
      const stats = await duelService.getPlayerStatistics();
      return stats;
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch statistics');
      return null;
    }
  };

  // Start polling for duel updates
  const startPolling = (duelId: string, interval = 2000) => {
    if (refreshInterval) clearInterval(refreshInterval);

    const timer = setInterval(() => {
      fetchDuel(duelId);
    }, interval);

    setRefreshInterval(timer);
  };

  // Stop polling
  const stopPolling = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return {
    activeDuel,
    fetchDuel,
    fetchStatistics,
    startPolling,
    stopPolling,
  };
};
