import { FaEllipsisVertical } from "react-icons/fa6";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MdOpenInNew } from "react-icons/md";
import { FaRegTrashAlt } from "react-icons/fa";
import { bucketsStorage } from "@/lib/storage";
import useBucket from "@/lib/store/useBucket.store";

const OptionsDropdown = ({ hostname }: { hostname: string }) => {
  const { buckets, setBuckets } = useBucket((state) => state);
  const openInNewTab = () => {
    window.open(`http://${hostname}`, "_blank");
  };

  const deleteBucket = () => {
    const updatedBuckets = buckets.filter(
      (bucket) => bucket.hostname !== hostname,
    );
    bucketsStorage.setValue(updatedBuckets);
    setBuckets(updatedBuckets);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex w-5 cursor-pointer justify-center">
        <FaEllipsisVertical className="group-hover:text-secondary-foreground/70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-fit min-w-0 -translate-x-10 translate-y-2 *:w-full">
        <DropdownMenuItem onClick={openInNewTab}>
          <MdOpenInNew className="text-white" />
          Open
        </DropdownMenuItem>
        <DropdownMenuItem onClick={deleteBucket}>
          <FaRegTrashAlt className="text-white" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default OptionsDropdown;
