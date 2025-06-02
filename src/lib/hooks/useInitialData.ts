import { useQuery } from "@tanstack/react-query";
import useBucket from "@/lib/store/useBucket.store";
import useLastSeen from "@/lib/store/useLastSeen.store";
import {
  bucketsStorage,
  isRecordingStorage,
  lastSeenStorage,
} from "@/lib/storage";
import useRecording from "../store/useRecording.store";
import { useEffect } from "react";

const useInitialData = () => {
  const { setBuckets } = useBucket.getState();
  const { setLastSeen } = useLastSeen.getState();
  const { setRecording, setRecordingLoading } = useRecording.getState();

  /**
   * Fetches the initial data for buckets.
   */
  useQuery({
    queryKey: ["buckets"],
    queryFn: async () => {
      const buckets = await bucketsStorage.getValue();
      setBuckets(buckets);
      return null;
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
      return null;
    },
  });

  const { data: isRecording, isLoading } = useQuery({
    queryKey: ["isRecording"],
    queryFn: async () => {
      const isRecording = await isRecordingStorage.getValue();
      setRecording(isRecording);
      return isRecording;
    },
  });

  useEffect(() => {
    setRecordingLoading(isLoading);
    if (isLoading) return;
    // Clear the badge text when the extension is opened
    const text = isRecording ? "" : "!";
    browser.action.setBadgeText({ text });
  }, [isRecording, isLoading]);
};

export default useInitialData;
