// import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { IBucketInfo } from "./types";
import TabButton from "@/components/TabButton";
import TabBuckets from "./components/TabBuckets";

function App() {
  const [buckets, setBuckets] = useState<
    Partial<Record<string, IBucketInfo[]>>
  >({});

  const types = ["good", "bad", "error"];

  const filterBuckets = async () => {
    const { buckets } = (await chrome.storage.session.get("buckets")) as {
      buckets: IBucketInfo[];
    };
    const groupedBuckets = Object.groupBy(buckets, (bucket) => bucket.type);
    setBuckets(groupedBuckets);
  };

  useEffect(() => {
    filterBuckets();
  }, []);

  return (
    <Tabs defaultValue="good" className="w-full">
      <div className="flex flex-col">
        <div className="space-y-4 bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <p className="text-lg font-bold">S3BucketList</p>
              <p className="text-xs italic text-muted-foreground">
                Records, lists, inspects S3 from Network
              </p>
            </div>
            {/* <div>
              <Switch />
            </div> */}
          </div>
          <TabsList className="w-full gap-x-3 px-2">
            {types.map((type) => (
              <TabButton type={type} />
            ))}
          </TabsList>
        </div>
        <Separator />
        {types.map((type) => {
          return <TabBuckets type={type} buckets={buckets[type]} />;
        })}
      </div>
    </Tabs>
  );
}

export default App;
