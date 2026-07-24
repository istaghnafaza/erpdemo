import { createJSONStorage, type StateStorage } from "zustand/middleware";

/** SSR-safe storage — avoids touching localStorage during Node SSR on Railway. */
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export function createSafeJSONStorage() {
  return createJSONStorage(() =>
    typeof window !== "undefined" ? localStorage : noopStorage,
  );
}
