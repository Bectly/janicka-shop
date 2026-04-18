import { create } from "zustand";

const MIN_HEIGHT = 240;
const MAX_HEIGHT = 800;
const DEFAULT_HEIGHT = 480;

interface JarvisConsoleState {
  isOpen: boolean;
  height: number;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setHeight: (h: number) => void;
}

export const useJarvisConsole = create<JarvisConsoleState>((set) => ({
  isOpen: false,
  height: DEFAULT_HEIGHT,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setHeight: (h) =>
    set({ height: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h)) }),
}));
