import { CircleMinus, Download, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@radix-ui/react-dropdown-menu";
import useBuckets from "@/store/useBuckets.store";

const MenuComponent = () => {
  const CLEARED_BUCKETS = { good: [], bad: [], error: [] };
  const { buckets, setBuckets } = useBuckets((state) => state);

  const handleClear = () => {
    chrome.storage.local.set({ buckets: CLEARED_BUCKETS });
    setBuckets(CLEARED_BUCKETS);
  };

  const generateSave = () => {
    const blob = new Blob([JSON.stringify(buckets, null, 2)], {
      type: "text/plain",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = "buckets.txt";
    a.href = url;
    a.click();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus-visible:outline-none">
        <Menu size={34} strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-36 rounded-md bg-white p-2 shadow-lg *:flex *:cursor-pointer *:items-center *:gap-x-1 *:p-2"
        align="end"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <DropdownMenuItem
          className="focus-visible:bg-slate-100 focus-visible:outline-none"
          onClick={handleClear}
        >
          <CircleMinus className="mr-2 h-4 w-4" />
          <span>Clear</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="focus-visible:bg-slate-100 focus-visible:outline-none"
          onClick={generateSave}
        >
          <Download className="mr-2 h-4 w-4" />
          <span>Download</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
export default MenuComponent;
