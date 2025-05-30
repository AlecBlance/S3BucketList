import { create } from "zustand";

interface IUseLastSeen {
  lastSeen: number;
  setLastSeen: (lastSeen: number) => void;
}

const useLastSeen = create<IUseLastSeen>((set) => ({
  lastSeen: 0,
  setLastSeen: (lastSeen: number) => set({ lastSeen }),
}));

export default useLastSeen;
