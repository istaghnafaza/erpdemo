// =============================================================================
// Theme Store — light/dark mode preference, persisted to localStorage.
// The actual `dark` class application to <html> happens in a small effect
// (see useApplyTheme in AppShell/__root) so this store stays UI-agnostic.
// =============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSafeJSONStorage } from "@/lib/safe-storage";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme(theme: Theme): void;
  toggleTheme(): void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    {
      name: "ses-theme",
      storage: createSafeJSONStorage(),
    },
  ),
);

export const selectTheme = (s: ThemeState) => s.theme;
