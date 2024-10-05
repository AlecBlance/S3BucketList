// import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { IBucketInfo } from "./types";
import TabButton from "@/components/TabButton";
import TabBuckets from "@/components/TabBuckets";
import { Switch } from "@/components/ui/switch";

function App() {
  const [buckets, setBuckets] = useState<
    Partial<Record<string, IBucketInfo[]>>
  >({});
  const [checked, setChecked] = useState(true);
  const [isDoneChecking, setIsDoneChecking] = useState(false);

  const types = ["good", "bad", "error"];

  const filterBuckets = async () => {
    const { buckets } = (await chrome.storage.local.get("buckets")) as {
      buckets: IBucketInfo[];
    };
    if (!buckets || !buckets.length) return;
    const groupedBuckets = Object.groupBy(buckets, (bucket) => bucket.type);
    setBuckets(groupedBuckets);
  };

  const checkRecord = async () => {
    const { record } = (await chrome.storage.local.get("record")) as {
      record: boolean;
    };
    console.log("to record", record);
    setChecked(record);
    setIsDoneChecking(true);
  };

  const handleCheck = async (isChecked: boolean) => {
    chrome.storage.local.set({ record: isChecked });
    chrome.runtime.sendMessage(isChecked);
    setChecked(isChecked);
  };

  useEffect(() => {
    filterBuckets();
    checkRecord();
  }, []);

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
              {isDoneChecking && (
                <Switch checked={checked} onCheckedChange={handleCheck} />
              )}
            </div>
          </div>
          <TabsList className="w-full gap-x-3 px-2">
            {types.map((type) => {
              const number = buckets[type] ? buckets[type].length : 0;
              return <TabButton type={type} number={number} />;
            })}
          </TabsList>
        </div>
        <Separator />
        <div className="grow overflow-y-auto">
          {types.map((type) => {
            return <TabBuckets type={type} buckets={buckets[type]} />;
          })}
        </div>
        <Separator />
        <div className="flex justify-between bg-white p-2 text-xs text-muted-foreground">
          <p>
            Made with ❤️ by{" "}
            <a href="http://alecblance.com" className="underline">
              Alec Blance
            </a>
          </p>
          <p>v3.0.0</p>
        </div>
      </div>
    </Tabs>
  );
}

export default App;
