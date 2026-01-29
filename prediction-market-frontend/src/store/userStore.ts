import { create } from 'zustand';
import type { User } from '../types/types';

interface UserStore {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    setUser: (user: User) => void;
    setToken: (token: string) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    logout: () => void;
    loadFromStorage: () => void;
}

const storedToken = localStorage.getItem('token');
const storedUserStr = localStorage.getItem('user');
let storedUser = null;
try {
    if (storedUserStr) storedUser = JSON.parse(storedUserStr);
} catch (e) {
    console.error('Failed to parse stored user', e);
}

export const useUserStore = create<UserStore>((set) => ({
    user: storedUser,
    token: storedToken,
    isAuthenticated: !!(storedToken && storedUser && (storedUser as User).wallet_address),
    isLoading: false,
    error: null,

    setUser: (user) => {
        localStorage.setItem('user', JSON.stringify(user));
        const token = localStorage.getItem('token');
        // User is fully authenticated only if they have both token AND wallet_address
        set({ user, isAuthenticated: !!(token && user.wallet_address) });
    },

    setToken: (token) => {
        localStorage.setItem('token', token);
        const userStr = localStorage.getItem('user');
        let user: User | null = null;
        try {
            if (userStr) user = JSON.parse(userStr);
        } catch (e) {
            console.error('Failed to parse user:', e);
        }
        set((state) => ({
            token,
            // User is fully authenticated only if they have both token AND wallet_address
            isAuthenticated: !!(token && (state.user?.wallet_address || user?.wallet_address))
        }));
    },

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error }),

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null, token: null, isAuthenticated: false });
    },

    loadFromStorage: () => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        if (token && userStr) {
            try {
                const user = JSON.parse(userStr) as User;
                set({
                    token,
                    user,
                    // User is fully authenticated only if they have both token AND wallet_address
                    isAuthenticated: !!(token && user.wallet_address),
                });
            } catch (e) {
                console.error('Failed to parse user from storage:', e);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
    },
}));
