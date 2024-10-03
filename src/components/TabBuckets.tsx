import { TabsContent } from "@/components/ui/tabs";
import { IBucketInfo } from "@/types";
import Bucket from "@/components/Bucket";

const TabBuckets = ({
  type,
  buckets,
}: {
  type: string;
  buckets: IBucketInfo[] | undefined;
}) => {
  return (
    <TabsContent value={type}>
      <div className="grow p-2">
        {buckets ? (
          buckets.map((info) => <Bucket info={info} />)
        ) : (
          <p className="p-2">No {type} buckets found</p>
        )}
      </div>
    </TabsContent>
  );
};
export default TabBuckets;
