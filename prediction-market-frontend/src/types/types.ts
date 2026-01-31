export interface User {
    id: number;
    wallet_address: string;
    x_username?: string;
    x_id?: string;
    x_avatar_url?: string;
    followers_count?: number;
    virtual_balance: number;
    referrer_id?: number;
    created_at: string;
}

export interface AuthResponse {
    token: string;
    user: User;
}

export interface ApiResponse<T> {
    success?: boolean;
    data?: T;
    error?: string;
    user?: User;
    balance?: number;
}

export interface Market {
    id: number;
    title: string;
    description: string;
    category: string;
    status: string;
    resolution_outcome?: string;
    created_by?: number;
    created_at: string;
    resolved_at?: string;
    events?: MarketEvent[];
}

export interface MarketEvent {
    id: number;
    market_id: number;
    event_title: string;
    event_description: string;
    outcome_type: string;
}

export interface Proposal {
    id: number;
    user_id: number;
    market_title: string;
    market_description: string;
    category: string;
    status: string;
    created_at: string;
}
