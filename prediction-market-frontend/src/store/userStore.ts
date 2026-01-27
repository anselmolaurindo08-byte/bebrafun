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
    isAuthenticated: !!(storedToken && storedUser),
    isLoading: false,
    error: null,

    setUser: (user) => {
        localStorage.setItem('user', JSON.stringify(user));
        const token = localStorage.getItem('token');
        set({ user, isAuthenticated: !!token });
    },

    setToken: (token) => {
        localStorage.setItem('token', token);
        const user = localStorage.getItem('user'); // Check storage or current state
        set((state) => ({
            token,
            isAuthenticated: !!(state.user || user)
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
                const user = JSON.parse(userStr);
                set({
                    token,
                    user,
                    isAuthenticated: true,
                });
            } catch (e) {
                console.error('Failed to parse user from storage:', e);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
    },
}));
