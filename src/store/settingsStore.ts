// src/store/settingsStore.ts
import { create } from "zustand";
import { AppSettings } from "../types";

interface SettingsState {
    settings: AppSettings | null;
    setSettings: (settings: AppSettings) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
    settings: null,
    setSettings: (settings) => set({ settings }),
}));
