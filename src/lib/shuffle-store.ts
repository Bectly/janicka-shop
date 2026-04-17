import { create } from "zustand";

interface ShuffleUIState {
  open: boolean;
  openShuffle: () => void;
  closeShuffle: () => void;
  toggleShuffle: () => void;
}

export const useShuffleStore = create<ShuffleUIState>((set) => ({
  open: false,
  openShuffle: () => set({ open: true }),
  closeShuffle: () => set({ open: false }),
  toggleShuffle: () => set((s) => ({ open: !s.open })),
}));
