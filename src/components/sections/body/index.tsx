import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BucketList from "./components/BucketList/BucketList";
import Search from "./components/Search";
import useBucket from "@/lib/store/useBucket.store";
import { matchesBucketFilter, BucketFilter } from "@/lib/bucket/findings";

const Body = () => {
  const { buckets } = useBucket((state) => state);
  const tabs: { value: BucketFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "listing", label: "Can list" },
    { value: "files", label: "Files seen" },
    { value: "unchecked", label: "Unchecked" },
  ];

  return (
    <div className="flex min-h-0 grow flex-col space-y-4 p-4">
      <Search />
      <Tabs defaultValue="all" className="flex min-h-0 w-full grow flex-col">
        <TabsList className="w-full bg-transparent p-0">
          {tabs.map((tab) => (
            <TabsTrigger
              value={tab.value}
              key={tab.value}
              className="data-[state=active]:!bg-primary data-[state=inactive]:!bg-secondary first:rounded-r-none last:rounded-l-none"
            >
              {tab.label} (
              {
                buckets.filter((bucket) =>
                  matchesBucketFilter(bucket, tab.value),
                ).length
              }
              )
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => {
          const filteredBuckets = buckets
            .filter((bucket) => matchesBucketFilter(bucket, tab.value))
            .reverse();
          return (
            <TabsContent
              value={tab.value}
              key={tab.value}
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
