import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { IBucketInfo } from "@/types";
import { Badge } from "./ui/badge";

const Bucket = ({
  info,
  lastSeen,
}: {
  info: IBucketInfo;
  lastSeen: number;
}) => {
  const isPermPresent = !!Object.keys(info.permissions).length;
  const isNew = info.date > lastSeen;
  console.log("lastSeen", lastSeen);
  console.log("isNew", isNew);
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
          <div className="mr-2 flex min-w-0 space-x-2">
            <p className="min-w-0 overflow-hidden text-ellipsis">
              {info.hostname}
            </p>
            {isNew && <Badge>new</Badge>}
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
