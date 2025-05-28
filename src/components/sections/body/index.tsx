import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Buckets from "./components/Buckets";

const Body = () => {
  const tabs = ["public", "private"];

  return (
    <div className="flex min-h-0 grow flex-col space-y-4 p-4">
      <div>
        <Input placeholder="Search" className="text-sm" />
      </div>
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
        {tabs.map((tab) => (
          <TabsContent
            value={tab}
            className="mt-2 flex min-h-0 grow flex-col space-y-4 overflow-y-auto pr-2"
          >
            <Buckets tab={tab} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Body;
