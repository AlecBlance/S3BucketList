import { IUseBuckets } from "@/types";
import { create } from "zustand";

const useBuckets = create<IUseBuckets>((set) => ({
  buckets: { good: [], bad: [], error: [] },
  setBuckets: (buckets) => set({ buckets }),
}));

export default useBuckets;
