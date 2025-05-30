import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Buckets from "./components/Buckets";
import Search from "./components/Search";
import { useQuery } from "@tanstack/react-query";
import { bucketsStorage } from "@/lib/storage";
import useBucket from "@/lib/store/useBucket.store";

const Body = () => {
  const { buckets, setBuckets } = useBucket((state) => state);
  const tabs = ["public", "private"];

  const { data = [], isLoading } = useQuery({
    queryKey: ["buckets"],
    queryFn: () => bucketsStorage.getValue(),
  });

  useEffect(() => {
    if (data && data.length) {
      setBuckets(data);
    }
  }, [data]);

  return (
    <div className="flex min-h-0 grow flex-col space-y-4 p-4">
      <Search />
      <Tabs defaultValue="public" className="flex min-h-0 w-full grow flex-col">
        <TabsList className="w-full bg-transparent p-0">
          {tabs.map((tab) => (
            <TabsTrigger
              value={tab}
              className="data-[state=active]:!bg-primary"
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
              className="mt-2 flex min-h-0 grow flex-col space-y-4 overflow-y-auto pr-2"
            >
              <Buckets buckets={filteredBuckets} />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};

export default Body;
