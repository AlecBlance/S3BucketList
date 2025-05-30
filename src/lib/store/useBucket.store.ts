import { IBucket } from "@/@types";
import { create } from "zustand";

interface IUseBucket {
  buckets: IBucket[];
  setBuckets: (buckets: IBucket[]) => void;
}

const useBucket = create<IUseBucket>((set) => ({
  buckets: [],
  setBuckets: (buckets: IBucket[]) => set({ buckets }),
}));

export default useBucket;
