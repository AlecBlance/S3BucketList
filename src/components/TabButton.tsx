import { TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const TabButton = ({ type }: { type: string }) => {
  const color =
    type === "good"
      ? "data-[state=active]:bg-green-600"
      : type === "bad"
        ? "data-[state=active]:bg-yellow-600"
        : "data-[state=active]:bg-red-600";

  return (
    <TabsTrigger
      value={type}
      className={cn(`grow normal-case ${color} data-[state=active]:text-white`)}
    >
      {type}
    </TabsTrigger>
  );
};
export default TabButton;
