import { useEffect, useRef, useState } from 'react';
import { Duel } from '../../types/duel';
import { getMarketId, getChartSymbol } from '../../utils/duelHelpers';

interface DuelGameViewProps {
    duel: Duel;
    onGameEnd: (winnerId: string | null) => void;
}

export default function DuelGameView({ duel, onGameEnd }: DuelGameViewProps) {
    // ... existing state ...

    const wsRef = useRef<WebSocket | null>(null);

    // Get marketId from duel (handles both camelCase and snake_case)
    const marketId = getMarketId(duel);
    const currencySymbol = getChartSymbol(marketId);

    useEffect(() => {
        console.log('[DuelGameView] Duel loaded:', {
            id: duel.id,
            marketId: duel.marketId,
            market_id: (duel as any).market_id,
            resolvedMarketId: marketId,
            chart: currencySymbol
        });

        // ... rest of useEffect ...
    }, []);

    // ... rest of component ...
}
