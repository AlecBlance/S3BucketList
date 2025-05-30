"use client";

import { IBucket } from "@/@types";
import BucketCard from "../BucketCard/BucketCard";
import useSearch from "@/lib/store/useSearch.store";
import { cn } from "@/lib/utils";
import Actions from "./Actions";

const BucketList = ({ buckets }: { buckets: IBucket[] }) => {
  const { query } = useSearch((state) => state);

  buckets = buckets.filter(
    (bucket) =>
      bucket.hostname.includes(query) || bucket.initiator?.includes(query),
  );

  return (
    <>
      <Actions buckets={buckets} />
      <div
        className={cn(
          "flex grow flex-col space-y-4 overflow-y-auto",
          buckets.length >= 4 && "pr-4",
        )}
      >
        {buckets.map((bucket) => (
          <BucketCard
            date={bucket.date}
            hostname={bucket.hostname}
            initiator={bucket.initiator}
            permissions={bucket.permissions}
            key={bucket.hostname}
          />
        ))}
      </div>
    </>
  );
};

export default BucketList;
