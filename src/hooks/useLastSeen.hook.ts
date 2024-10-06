import useLastSeen from "../store/useLastSeen.store";
import { useEffect } from "react";

const useLastSeenHook = () => {
  const { setLastSeen } = useLastSeen.getState();

  const lastSeen = async () => {
    const { lastSeen } = await chrome.storage.local.get("lastSeen");
    chrome.storage.local.set({
      lastSeen: { ...lastSeen, good: new Date().getTime() },
    });
    setLastSeen(lastSeen);
  };

  useEffect(() => {
    lastSeen();
  }, []);
};
export default useLastSeenHook;
