// src/store/authStore.ts
import { create } from "zustand";
import { AuthUserData } from "../types";

interface AuthState {
    user: AuthUserData | null;
    sessionToken: string | null;
    setSession: (user: AuthUserData, token: string) => void;
    clearSession: () => void;
    isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
    user: null,
    sessionToken: null,
    setSession: (user, token) => set({ user, sessionToken: token }),
    clearSession: () => set({ user: null, sessionToken: null }),
    isAdmin: () => get().user?.role === "ADMIN",
}));
