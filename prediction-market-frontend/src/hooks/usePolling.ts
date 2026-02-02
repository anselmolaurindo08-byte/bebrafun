import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for polling data at regular intervals
 * @param callback Function to call on each poll
 * @param interval Polling interval in milliseconds
 * @param enabled Whether polling is enabled
 */
export function usePolling(
    callback: () => Promise<void> | void,
    interval: number = 5000,
    enabled: boolean = true
) {
    const savedCallback = useRef(callback);
    const timeoutId = useRef<NodeJS.Timeout | null>(null);

    // Update callback ref when it changes
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    const poll = useCallback(async () => {
        if (!enabled) return;

        try {
            await savedCallback.current();
        } catch (error) {
            console.error('Polling error:', error);
        }

        // Schedule next poll
        if (enabled) {
            timeoutId.current = setTimeout(poll, interval);
        }
    }, [interval, enabled]);

    useEffect(() => {
        if (!enabled) {
            if (timeoutId.current) {
                clearTimeout(timeoutId.current);
                timeoutId.current = null;
            }
            return;
        }

        // Start polling
        poll();

        // Cleanup on unmount or when dependencies change
        return () => {
            if (timeoutId.current) {
                clearTimeout(timeoutId.current);
                timeoutId.current = null;
            }
        };
    }, [poll, enabled]);
}
