import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { IBucketInfo } from "@/types";

const Bucket = ({ info }: { info: IBucketInfo }) => {
  const isPermPresent = !!Object.keys(info.permissions).length;
  return (
    <Accordion
      type="single"
      collapsible
      className="first:rounded-tl-md first:rounded-tr-md"
    >
      <AccordionItem value="item-1">
        <AccordionTrigger
          className="bg-card p-2 text-sm hover:no-underline"
          isPermPresent={isPermPresent}
        >
          {info.hostname}
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
