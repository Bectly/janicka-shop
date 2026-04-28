import { create } from "zustand";

export type SessionRole = "customer" | "admin" | null;

interface AuthState {
  role: SessionRole;
  setRole: (role: SessionRole) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  role: null,
  setRole: (role) => set({ role }),
}));
