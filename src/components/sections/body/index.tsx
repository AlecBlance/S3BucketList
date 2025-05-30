import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BucketList from "./components/BucketList/BucketList";
import Search from "./components/Search";
import useBucket from "@/lib/store/useBucket.store";

const Body = () => {
  const { buckets } = useBucket((state) => state);
  const tabs = ["public", "private"];

  return (
    <div className="flex min-h-0 grow flex-col space-y-4 p-4">
      <Search />
      <Tabs defaultValue="public" className="flex min-h-0 w-full grow flex-col">
        <TabsList className="w-full bg-transparent p-0">
          {tabs.map((tab) => (
            <TabsTrigger
              value={tab}
              className="data-[state=active]:!bg-primary data-[state=inactive]:!bg-secondary first:rounded-r-none last:rounded-l-none"
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => {
          const filteredBuckets = buckets
            .filter((bucket) => bucket.public === (tab === "public"))
            .reverse();
          return (
            <TabsContent
              value={tab}
              className="mt-2 flex min-h-0 grow flex-col space-y-4"
            >
              <BucketList buckets={filteredBuckets} />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};

export default Body;
