import { TabsContent } from "@/components/ui/tabs";
import { IBucketInfo } from "@/types";
import Bucket from "@/components/Bucket";
import useLastSeen from "@/store/useLastSeen.store";
import { memo } from "react";
import _ from "lodash";

const TabBuckets = ({
  type,
  buckets,
}: {
  type: string;
  buckets: IBucketInfo[];
}) => {
  const lastSeen = useLastSeen(
    (state) => state.lastSeen[type as keyof typeof state.lastSeen],
  );

  return (
    <TabsContent value={type}>
      <div className="grow p-2">
        {buckets.length ? (
          buckets.map((info) => (
            <Bucket
              info={info}
              lastSeen={lastSeen}
              buckets={buckets}
              type={type}
            />
          ))
        ) : (
          <p className="p-2">No {type} buckets found</p>
        )}
      </div>
    </TabsContent>
  );
};

const areEqual = (prevProps: any, nextProps: any) => {
  return _.isEqual(prevProps, nextProps);
};

export default memo(TabBuckets, areEqual);
