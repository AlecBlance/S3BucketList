import { useQuery } from "@tanstack/react-query";
import useBucket from "@/lib/store/useBucket.store";
import useLastSeen from "@/lib/store/useLastSeen.store";
import { bucketsStorage, lastSeenStorage } from "@/lib/storage";

const useInitialData = () => {
  const { setBuckets } = useBucket.getState();
  const { setLastSeen } = useLastSeen.getState();

  /**
   * Fetches the initial data for buckets.
   */
  useQuery({
    queryKey: ["buckets"],
    queryFn: async () => {
      const buckets = await bucketsStorage.getValue();
      setBuckets(buckets);
    },
  });

  /**
   * Fetches the initial last seen date.
   */
  useQuery({
    queryKey: ["lastSeen"],
    queryFn: async () => {
      const lastSeen = await lastSeenStorage.getValue();
      lastSeenStorage.setValue(Date.now());
      setLastSeen(lastSeen);
    },
  });
};

export default useInitialData;
