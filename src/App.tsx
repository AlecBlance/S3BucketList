import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { useCallback, useEffect, useState } from "react";
import { IBucketType, ILastSeen } from "./types";
import TabButton from "@/components/TabButton";
import TabBuckets from "@/components/TabBuckets";
import CustomSwitch from "./components/CustomSwitch";
import useBuckets from "@/store/useBuckets.store";
import useLastSeen from "@/store/useLastSeen.store";
import Menu from "@/components/Menu";

function App() {
  const { setLastSeen } = useLastSeen.getState();
  const [currentLastSeen, setCurrentLastSeen] = useState<Partial<ILastSeen>>(
    {},
  );

  const { buckets, setBuckets } = useBuckets((state) => state);
  const types = ["good", "bad", "error"];

  const filterBuckets = useCallback(async () => {
    const { buckets } = (await chrome.storage.local.get("buckets")) as {
      buckets: IBucketType;
    };
    setBuckets(buckets);
  }, [setBuckets]);

  const lastSeen = useCallback(async () => {
    const { lastSeen } = await chrome.storage.local.get("lastSeen");
    const updatedLastSeen = { ...lastSeen, good: new Date().getTime() };
    chrome.storage.local.set({
      lastSeen: updatedLastSeen,
    });
    setLastSeen(updatedLastSeen);
    setCurrentLastSeen(lastSeen);
  }, [setLastSeen]);

  useEffect(() => {
    filterBuckets();
    lastSeen();
  }, [filterBuckets, lastSeen]);

  return (
    <Tabs defaultValue="good" className="w-full">
      <div className="flex h-dvh flex-col">
        <div className="space-y-4 bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <p className="text-lg font-bold">S3BucketList</p>
              <p className="text-xs italic text-muted-foreground">
                Records, lists, inspects S3 from Network
              </p>
            </div>
            <div>
              <CustomSwitch />
            </div>
          </div>
          <div className="flex items-center gap-x-2">
            <TabsList className="w-full gap-x-3 px-2">
              {types.map((type) => {
                const number = buckets[type] ? buckets[type].length : 0;
                return <TabButton type={type} number={number} />;
              })}
            </TabsList>
            <Menu />
          </div>
        </div>
        <Separator />
        <div className="grow overflow-y-auto">
          {types.map((type) => {
            return (
              <TabBuckets
                type={type}
                buckets={buckets[type]}
                lastSeen={currentLastSeen[type]!}
              />
            );
          })}
        </div>
        <Separator />
        <div className="flex justify-between bg-white p-2 text-xs text-muted-foreground">
          <p>
            Made with ❤️ by{" "}
            <a
              href="http://alecblance.com"
              className="underline"
              target="_blank"
            >
              Alec Blance
            </a>
          </p>
          <p>v3.0.1</p>
        </div>
      </div>
    </Tabs>
  );
}

export default App;
