import { TabsTrigger } from "@/components/ui/tabs";
import useLastSeen from "@/store/useLastSeen.store";

const TabButton = ({ type, number }: { type: string; number: number }) => {
  const { lastSeen } = useLastSeen((state) => state);
  const color =
    type === "good"
      ? "data-[state=active]:bg-green-600"
      : type === "bad"
        ? "data-[state=active]:bg-yellow-600"
        : "data-[state=active]:bg-red-600";
  const tabNumberColor =
    type === "good"
      ? "peer-data-[state=inactive]:bg-green-600"
      : type === "bad"
        ? "peer-data-[state=inactive]:bg-yellow-600"
        : "peer-data-[state=inactive]:bg-red-600";

  const handleLastSeenTrigger = async () => {
    const dateNow = new Date().getTime();
    chrome.storage.local.set({ lastSeen: { ...lastSeen, [type]: dateNow } });
  };

  return (
    <div className="relative flex grow">
      <TabsTrigger
        value={type}
        className={`grow ${color} peer data-[state=active]:text-white`}
        onClick={handleLastSeenTrigger}
      >
        {type}
      </TabsTrigger>
      {number ? (
        <div
          className={`absolute -top-2 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs peer-data-[state=inactive]:text-white ${tabNumberColor} font-bold`}
        >
          {number}
        </div>
      ) : null}
    </div>
  );
};
export default TabButton;
