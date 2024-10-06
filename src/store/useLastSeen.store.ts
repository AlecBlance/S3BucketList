import { IUseLastSeen } from "@/types";
import { create } from "zustand";

const useLastSeenStore = create<IUseLastSeen>((set) => ({
  lastSeen: { good: 0, bad: 0, error: 0 },
  addLastSeen: ({ type, date }) =>
    set((state) => ({ lastSeen: { ...state.lastSeen, [type]: date } })),
  setLastSeen: (lastSeen) => set({ lastSeen }),
}));

export default useLastSeenStore;
