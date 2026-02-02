import { useState, useCallback } from 'react';
import { usePolling } from './usePolling';
import { duelService } from '../services/duelService';
import type { Duel } from '../types/duel';

/**
 * Hook for polling a single duel's status
 * @param duelId Duel ID to poll
 * @param interval Polling interval in milliseconds (default: 3000ms)
 * @param enabled Whether polling is enabled (default: true)
 */
export function useDuelPolling(
    duelId: string | null,
    interval: number = 3000,
    enabled: boolean = true
) {
    const [duel, setDuel] = useState<Duel | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDuel = useCallback(async () => {
        if (!duelId) return;

        try {
            setLoading(true);
            setError(null);
            const updatedDuel = await duelService.getDuel(duelId);
            setDuel(updatedDuel);
        } catch (err: any) {
            console.error('Failed to fetch duel:', err);
            setError(err.message || 'Failed to fetch duel');
        } finally {
            setLoading(false);
        }
    }, [duelId]);

    // Use polling hook
    usePolling(fetchDuel, interval, enabled && !!duelId);

    return {
        duel,
        loading,
        error,
        refetch: fetchDuel,
    };
}

/**
 * Hook for polling active duels list
 * @param interval Polling interval in milliseconds (default: 5000ms)
 * @param enabled Whether polling is enabled (default: true)
 */
export function useActiveDuelsPolling(
    interval: number = 5000,
    enabled: boolean = true
) {
    const [duels, setDuels] = useState<Duel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDuels = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await duelService.getActiveDuels(50);
            setDuels(response.duels);
        } catch (err: any) {
            console.error('Failed to fetch active duels:', err);
            setError(err.message || 'Failed to fetch duels');
        } finally {
            setLoading(false);
        }
    }, []);

    // Use polling hook
    usePolling(fetchDuels, interval, enabled);

    return {
        duels,
        loading,
        error,
        refetch: fetchDuels,
    };
}

/**
 * Hook for polling user's duels
 * @param interval Polling interval in milliseconds (default: 5000ms)
 * @param enabled Whether polling is enabled (default: true)
 */
export function useUserDuelsPolling(
    interval: number = 5000,
    enabled: boolean = true
) {
    const [duels, setDuels] = useState<Duel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDuels = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await duelService.getPlayerDuels(20, 0);
            setDuels(response.duels);
        } catch (err: any) {
            console.error('Failed to fetch user duels:', err);
            setError(err.message || 'Failed to fetch duels');
        } finally {
            setLoading(false);
        }
    }, []);

    // Use polling hook
    usePolling(fetchDuels, interval, enabled);

    return {
        duels,
        loading,
        error,
        refetch: fetchDuels,
    };
}
