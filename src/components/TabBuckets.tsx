import { TabsContent } from "@/components/ui/tabs";
import { IBucketInfo } from "@/types";
import Bucket from "@/components/Bucket";
import useLastSeen from "@/store/useLastSeen.store";

const TabBuckets = ({
  type,
  buckets,
}: {
  type: string;
  buckets: IBucketInfo[] | undefined;
}) => {
  const lastSeen = useLastSeen(
    (state) => state.lastSeen[type as keyof typeof state.lastSeen],
  );

  return (
    <TabsContent value={type}>
      <div className="grow p-2">
        {buckets ? (
          buckets.map((info) => <Bucket info={info} lastSeen={lastSeen} />)
        ) : (
          <p className="p-2">No {type} buckets found</p>
        )}
      </div>
    </TabsContent>
  );
};
export default TabBuckets;
