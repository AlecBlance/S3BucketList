import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { IBucketInfo } from "@/types";
import { Badge } from "./ui/badge";
import { EllipsisVertical, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useBuckets from "@/store/useBuckets.store";

const Bucket = ({
  info,
  lastSeen,
  buckets,
  type,
}: {
  info: IBucketInfo;
  lastSeen: number;
  buckets: IBucketInfo[];
  type: string;
}) => {
  const { buckets: bucketState, setBuckets } = useBuckets((state) => state);
  const isPermPresent = !!Object.keys(info.permissions).length;
  const isNew = info.date > lastSeen;

  const handleRemove = () => {
    const updatedBucket = {
      ...bucketState,
      [type]: buckets.filter((b: IBucketInfo) => b.hostname !== info.hostname),
    };
    chrome.storage.local.set({
      buckets: updatedBucket,
    });
    setBuckets(updatedBucket);
  };

  return (
    <Accordion
      type="single"
      collapsible
      className="first:rounded-tl-md first:rounded-tr-md"
    >
      <AccordionItem value="item-1">
        <AccordionTrigger
          className="min-w-0 bg-card p-2 text-sm hover:no-underline"
          isPermPresent={isPermPresent}
        >
          <div className="flex w-full min-w-0 items-center justify-between">
            <div className="flex min-w-0 items-center space-x-2">
              <p className="min-w-0 overflow-hidden text-ellipsis">
                {info.hostname}
              </p>
              {isNew && <Badge>new</Badge>}
            </div>
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="focus-visible:outline-none"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <EllipsisVertical className="z-10 h-4 w-6 hover:text-slate-400" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  {/* <DropdownMenuItem>
                    <Ban className="mr-2 h-4 w-4" />
                    <span>Blacklist</span>
                  </DropdownMenuItem> */}
                  <DropdownMenuItem onClick={handleRemove}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Remove</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </AccordionTrigger>
        {isPermPresent && (
          <AccordionContent className="bg-secondary p-2 text-xs">
            <div className="flex flex-col gap-y-2">
              {Object.entries(info.permissions).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-y-1">
                  <p className="font-bold">{key}</p>
                  <ul className="list-inside list-disc">
                    {value.map((perm) => (
                      <li key={perm}>{perm}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </AccordionContent>
        )}
      </AccordionItem>
    </Accordion>
  );
};

export default Bucket;
