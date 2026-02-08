import axios, { type AxiosInstance } from 'axios';
import type { User, ApiResponse } from '../types/types';
import type { TradeQuote } from './types/blockchain';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface CreatePoolRequest {
    market_id?: number;
    program_id: string;
    authority: string;
    yes_mint: string;
    no_mint: string;
    yes_reserve: number;
    no_reserve: number;
    fee_percentage: number;
}

export interface PoolResponse {
    id: string;
    market_id: number;
    program_id: string;
    authority: string;
    yes_mint: string;
    no_mint: string;
    yes_reserve: number;
    no_reserve: number;
    fee_percentage: number;
    total_liquidity: number;
    yes_price: number;
    no_price: number;
    status: string;
    created_at: string;
    updated_at: string;
}

class ApiService {
    private api: AxiosInstance;

    constructor() {
        this.api = axios.create({
            baseURL: API_URL,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Add token to requests if it exists
        this.api.interceptors.request.use((config) => {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });
    }

    // Auth endpoints
    async walletLogin(walletAddress: string, signature: string, inviteCode?: string): Promise<{ token: string; user: User }> {
        const response = await this.api.post<{ token: string; user: User }>('/auth/wallet', {
            wallet_address: walletAddress,
            signature,
            invite_code: inviteCode,
        });
        return response.data;
    }

    async logout(): Promise<void> {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        await this.api.post('/auth/logout');
    }

    async getMe(): Promise<User> {
        const response = await this.api.get<{ user: User }>('/auth/me');
        return response.data.user;
    }

    // User endpoints
    async getProfile(): Promise<User> {
        const response = await this.api.get<ApiResponse<{ user: User }>>('/api/user/profile');
        const user = response.data.user!;
        return user;
    }

    async getCurrentUser(): Promise<User> {
        return this.getProfile();
    }

    async getBalance(): Promise<number> {
        try {
            const response = await this.api.get<ApiResponse<{ balance: number }>>('/api/user/balance');
            return response.data.balance || 0;
        } catch {
            return 0;
        }
    }

    async updateNickname(nickname: string): Promise<void> {
        await this.api.patch('/api/user/nickname', { nickname });
    }

    async getUserVolume(): Promise<{ duel_volume_sol: number; market_volume_sol: number; total_volume_sol: number }> {
        const response = await this.api.get<{ duel_volume_sol: number; market_volume_sol: number; total_volume_sol: number }>('/api/user/volume');
        return response.data;
    }

    // Health check
    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.api.get('/health');
            return response.status === 200;
        } catch {
            return false;
        }
    }

    // Market endpoints
    async getMarkets(category?: string): Promise<any[]> {
        const params = category ? `?category=${category}` : '';
        const response = await this.api.get<ApiResponse<any[]>>(`/api/markets${params}`);
        return response.data.data || [];
    }

    async getMarketById(id: string): Promise<any> {
        const response = await this.api.get<ApiResponse<any>>(`/api/markets/${id}`);
        return response.data.data!;
    }

    async proposeMarket(data: {
        title: string;
        description: string;
        category: string;
    }): Promise<void> {
        await this.api.post('/api/markets/propose', data);
    }

    async createMarket(data: {
        title: string;
        description: string;
        category: string;
        outcomes: string[];
    }): Promise<any> {
        const response = await this.api.post<ApiResponse<any>>('/api/markets', data);
        return response.data.data!;
    }

    async getPendingProposals(): Promise<any[]> {
        const response = await this.api.get<ApiResponse<any[]>>('/api/markets/proposals/pending');
        return response.data.data || [];
    }

    async moderateProposal(id: number, action: 'approve' | 'reject'): Promise<void> {
        await this.api.post(`/api/markets/proposals/${id}/moderate`, { action });
    }

    async resolveMarket(marketId: string, outcome: string): Promise<void> {
        await this.api.post(`/api/markets/${marketId}/resolve`, { outcome });
    }

    // AMM endpoints
    async createPool(data: CreatePoolRequest): Promise<PoolResponse> {
        const response = await this.api.post<PoolResponse>('/api/amm/pools', data);
        return response.data;
    }

    async getPools(marketId?: string): Promise<any[]> {
        const params = marketId ? `?market_id=${marketId}` : '';
        const response = await this.api.get<any>(`/api/amm/pools${params}`);
        return response.data.pools || [];
    }

    async getPool(poolId: string): Promise<any> {
        const response = await this.api.get<ApiResponse<any>>(`/api/amm/pools/${poolId}`);
        return response.data.data!;
    }

    async getTradeQuote(poolId: string, inputAmount: string, tradeType: number): Promise<TradeQuote> {
        const response = await this.api.get<ApiResponse<TradeQuote>>(`/api/amm/quote?pool_id=${poolId}&input_amount=${inputAmount}&trade_type=${tradeType}`);
        return response.data.data!;
    }

    async recordTrade(data: {
        pool_id: string;
        trade_type: number;
        input_amount: string;
        output_amount: string;
        fee_amount: string;
        transaction_signature: string;
    }): Promise<void> {
        await this.api.post('/api/amm/trades', data);
    }

    async getUserAMMPositions(userAddress: string): Promise<any[]> {
        const response = await this.api.get<ApiResponse<any[]>>(`/api/amm/positions/user/${userAddress}`);
        return response.data.data || [];
    }

    async getPriceHistory(poolId: string, limit = 200): Promise<any> {
        const response = await this.api.get<any>(`/api/amm/prices/${poolId}?limit=${limit}`);
        return response.data;
    }

    // Duel endpoints
    async createDuel(data: { duel_id?: number; bet_amount: number; market_id?: number; event_id?: string; predicted_outcome?: string; direction?: number; currency?: string; signature: string }): Promise<any> {
        const response = await this.api.post<ApiResponse<any>>('/api/duels', data);
        return response.data;
    }

    async getDuel(duelId: string): Promise<any> {
        const response = await this.api.get<ApiResponse<any>>(`/api/duels/${duelId}`);
        return response.data;
    }

    async getPlayerDuels(limit = 20, offset = 0): Promise<{ duels: any[]; total: number }> {
        const response = await this.api.get<any>('/api/duels', { params: { limit, offset } });
        return response.data;
    }

    async getPlayerStatistics(): Promise<any> {
        const response = await this.api.get<ApiResponse<any>>('/api/duels/stats');
        return response.data;
    }

    async depositToDuel(duelId: string, data: { signature: string }): Promise<void> {
        await this.api.post(`/api/duels/${duelId}/deposit`, data);
    }

    async cancelDuel(duelId: string): Promise<void> {
        await this.api.post(`/api/duels/${duelId}/cancel`);
    }

    async joinDuel(duelId: string, data: { signature: string; direction?: number }): Promise<any> {
        const response = await this.api.post<ApiResponse<any>>(`/api/duels/${duelId}/join`, data);
        return response.data;
    }

    async resolveDuel(duelId: string, winnerId: string, winnerAmount: number): Promise<void> {
        await this.api.post(`/api/admin/duels/${duelId}/resolve`, {
            winner_id: winnerId,
            winner_amount: winnerAmount,
        });
    }

    async resolveDuelWithPrice(data: {
        duelId: string;
        winnerId: string;
        exitPrice: number;
        transactionHash: string;
    }): Promise<any> {
        const response = await this.api.post('/api/duels/resolve', data);
        return response.data;
    }

    async getActiveDuels(limit = 50): Promise<{ duels: any[]; total: number }> {
        const response = await this.api.get<any>('/api/duels/status/active', { params: { limit } });
        return response.data;
    }

    async getDuelConfig(): Promise<{ serverWallet: string; network: string }> {
        const response = await this.api.get<{ serverWallet: string; network: string }>('/api/duels/config');
        return response.data;
    }

    async autoResolveDuel(duelId: string, exitPrice: number): Promise<any> {
        const response = await this.api.post<ApiResponse<any>>(`/api/duels/${duelId}/auto-resolve`, {
            exit_price: exitPrice,
        });
        return response.data;
    }

    async setChartStartPrice(duelId: string, price: number): Promise<void> {
        await this.api.post(`/api/duels/${duelId}/chart-start`, {
            price,
        });
    }

    async claimWinnings(duelId: string): Promise<any> {
        const response = await this.api.post<ApiResponse<any>>(`/api/duels/${duelId}/claim`);
        return response.data;
    }

    // Wallet/Blockchain endpoints
    async connectWallet(data: { wallet_address: string }): Promise<any> {
        const response = await this.api.post<ApiResponse<any>>('/api/wallet/connect', data);
        return response.data.data;
    }

    async disconnectWallet(): Promise<void> {
        await this.api.delete('/api/wallet/disconnect');
    }

    async getWalletConnection(): Promise<any> {
        const response = await this.api.get<ApiResponse<any>>('/api/wallet');
        return response.data.data;
    }

    async refreshWalletBalance(): Promise<any> {
        const response = await this.api.post<ApiResponse<any>>('/api/wallet/refresh');
        return response.data.data;
    }

    async getWalletBalances(): Promise<any> {
        const response = await this.api.get<ApiResponse<any>>('/api/wallet/balances');
        return response.data.data;
    }

    // Escrow endpoints
    async getEscrowBalance(): Promise<any> {
        const response = await this.api.get<ApiResponse<any>>('/api/escrow/balance');
        return response.data.data;
    }

    async getEscrowTransactions(): Promise<any[]> {
        const response = await this.api.get<ApiResponse<any[]>>('/api/escrow/transactions');
        return response.data.data || [];
    }

    async lockTokensForDuel(data: {
        duel_id: number;
        amount: string;
        transaction_hash: string;
    }): Promise<any> {
        const response = await this.api.post<ApiResponse<any>>('/api/escrow/lock', data);
        return response.data.data;
    }

    async confirmEscrowDeposit(data: {
        escrow_transaction_id: number;
        transaction_hash: string;
    }): Promise<void> {
        await this.api.post('/api/escrow/confirm', data);
    }

    // Referral endpoints
    async getReferralCode(): Promise<any> {
        const response = await this.api.get<ApiResponse<any>>('/api/referral/code');
        return response.data.data;
    }

    async applyReferralCode(code: string): Promise<void> {
        await this.api.post('/api/referral/apply', { code });
    }

    async getReferralStats(): Promise<any> {
        const response = await this.api.get<ApiResponse<any>>('/api/referral/stats');
        return response.data.data;
    }

    async getReferralRebates(): Promise<any[]> {
        const response = await this.api.get<ApiResponse<any[]>>('/api/referral/rebates');
        return response.data.data || [];
    }

    async getUserReferrals(): Promise<any[]> {
        const response = await this.api.get<ApiResponse<any[]>>('/api/referral/referrals');
        return response.data.data || [];
    }

    // Social share endpoints
    async shareWinOnTwitter(data: {
        market_id: number;
        pnl_amount: string;
        share_url: string;
    }): Promise<any> {
        const response = await this.api.post<ApiResponse<any>>('/api/social/share/twitter', data);
        return response.data.data;
    }

    async getSocialShares(): Promise<any[]> {
        const response = await this.api.get<ApiResponse<any[]>>('/api/social/shares');
        return response.data.data || [];
    }

    // Admin endpoints
    async getAdminDashboard(): Promise<any> {
        const response = await this.api.get<ApiResponse<any>>('/api/admin/dashboard');
        return response.data.data;
    }

    async getAdminContests(): Promise<any[]> {
        const response = await this.api.get<ApiResponse<any[]>>('/api/admin/contests');
        return response.data.data || [];
    }

    async createAdminContest(data: {
        name: string;
        description: string;
        start_date: string;
        end_date: string;
        prize_pool: string;
        rules: string;
    }): Promise<void> {
        await this.api.post('/api/admin/contests', data);
    }

    async startAdminContest(contestId: number): Promise<void> {
        await this.api.post(`/api/admin/contests/${contestId}/start`);
    }

    async endAdminContest(contestId: number): Promise<void> {
        await this.api.post(`/api/admin/contests/${contestId}/end`);
    }

    async getAdminContestLeaderboard(contestId: number): Promise<any[]> {
        const response = await this.api.get<ApiResponse<any[]>>(`/api/admin/contests/${contestId}/leaderboard`);
        return response.data.data || [];
    }

    async getAdminUsers(limit: number, offset: number, search: string): Promise<{ data: any[]; total: number }> {
        const response = await this.api.get<ApiResponse<any>>(`/api/admin/users?limit=${limit}&offset=${offset}&search=${search}`);
        return { data: response.data.data || [], total: (response.data as any).total || 0 };
    }

    async restrictUser(data: {
        user_id: number;
        restriction_type: string;
        reason: string;
        duration_days: number;
    }): Promise<void> {
        await this.api.post('/api/admin/users/restrict', data);
    }

    async updateUserBalance(data: {
        user_id: number;
        amount: string;
        reason: string;
    }): Promise<void> {
        await this.api.post('/api/admin/users/balance', data);
    }

    async promoteToAdmin(data: {
        user_id: number;
        role: string;
    }): Promise<void> {
        await this.api.post('/api/admin/users/promote', data);
    }

    async getAdminLogs(): Promise<any[]> {
        const response = await this.api.get<ApiResponse<any[]>>('/api/admin/logs');
        return response.data.data || [];
    }

    async getPlatformStats(date: string): Promise<any> {
        const response = await this.api.get<ApiResponse<any>>(`/api/admin/stats?date=${date}`);
        return response.data.data;
    }

    // Legacy OrderBook stubs (to prevent build errors until components are refactored)
    async getOrderBook(_marketId: number, _eventId: number): Promise<any> {
        return { bids: [], asks: [] };
    }

    async placeOrder(_data: any): Promise<void> {
        throw new Error("Order book trading is disabled. Use AMM.");
    }

    async getUserPortfolio(_marketId: number): Promise<any[]> {
        return [];
    }

    async getUserPnL(_marketId: number): Promise<any> {
        return 0;
    }
}

export default new ApiService();
