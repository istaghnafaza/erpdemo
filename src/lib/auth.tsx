import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { USERS, type Role, type User } from "./mock-data";

interface AuthCtx {
  user: User | null;
  login: (username: string, password: string) => User | null;
  logout: () => void;
  loginAs: (role: Role) => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const STORAGE_KEY = "ses-demo-user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) setUser(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, []);

  const login = (username: string, password: string) => {
    const found = USERS.find((u) => u.username === username && u.password === password) ?? null;
    if (found) {
      setUser(found);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(found));
    }
    return found;
  };

  const loginAs = (role: Role) => {
    const found = USERS.find((u) => u.role === role);
    if (found) {
      setUser(found);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(found));
    }
  };

  const logout = () => {
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  return <Ctx.Provider value={{ user, login, logout, loginAs }}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
};

export const roleLabel = (role: Role) =>
  role === "owner" ? "Pemilik" : role === "manager" ? "Manajer" : "Kasir";
