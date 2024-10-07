import { TabsContent } from "@/components/ui/tabs";
import { IBucketInfo } from "@/types";
import Bucket from "@/components/Bucket";
import { memo } from "react";
import _ from "lodash";

const TabBuckets = ({
  type,
  buckets,
  lastSeen,
}: {
  type: string;
  buckets: IBucketInfo[];
  lastSeen: number;
}) => {
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
