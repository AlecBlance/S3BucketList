import { TabsTrigger } from "@/components/ui/tabs";
import useLastSeen from "@/store/useLastSeen.store";
import { memo } from "react";
import _ from "lodash";

const TabButton = ({ type, number }: { type: string; number: number }) => {
  const { lastSeen, addLastSeen } = useLastSeen((state) => state);

  const color: Record<string, Record<string, string>> = {
    good: {
      button: "data-[state=active]:bg-green-600",
      number: "peer-data-[state=inactive]:bg-green-600",
    },
    bad: {
      button: "data-[state=active]:bg-yellow-600",
      number: "peer-data-[state=inactive]:bg-yellow-600",
    },
    error: {
      button: "data-[state=active]:bg-red-600",
      number: "peer-data-[state=inactive]:bg-red-600",
    },
  };

  const handleLastSeenTrigger = async () => {
    const dateNow = new Date().getTime();
    chrome.storage.local.set({ lastSeen: { ...lastSeen, [type]: dateNow } });
    addLastSeen({ type, date: dateNow });
  };

  return (
    <div className="relative flex grow">
      <TabsTrigger
        value={type}
        className={`grow ${color[type]["button"]} peer data-[state=active]:text-white`}
        onClick={handleLastSeenTrigger}
      >
        {type}
      </TabsTrigger>
      {number ? (
        <div
          className={`absolute -top-2 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs peer-data-[state=inactive]:text-white ${color[type]["number"]} font-bold`}
        >
          {number}
        </div>
      ) : null}
    </div>
  );
};

const areEqual = (prevProps: any, nextProps: any) => {
  return _.isEqual(prevProps, nextProps);
};

export default memo(TabButton, areEqual);
