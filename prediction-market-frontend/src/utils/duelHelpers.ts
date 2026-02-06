// Helper to extract marketId from duel object
// Backend returns market_id (snake_case), but TypeScript expects marketId (camelCase)
export function getMarketId(duel: any): number {
    return duel.marketId || duel.market_id || 1; // Default to SOL if not found
}

// Helper to get chart symbol from marketId
export function getChartSymbol(marketId: number): string {
    return marketId === 2 ? 'PUMPUSDT' : 'SOLUSDT';
}
