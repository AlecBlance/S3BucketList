"use client";

import { IBucket } from "@/@types";
import BucketCard from "./BucketCard/BucketCard";
import useSearch from "@/lib/store/useSearch.store";
import useBucket from "@/lib/store/useBucket.store";

const Buckets = ({ buckets }: { buckets: IBucket[] }) => {
  const { query } = useSearch((state) => state);

  buckets = buckets.filter(
    (bucket) =>
      bucket.hostname.includes(query) || bucket.initiator?.includes(query),
  );

  return buckets.map((bucket) => (
    <BucketCard
      date={bucket.date}
      hostname={bucket.hostname}
      initiator={bucket.initiator}
      permissions={bucket.permissions}
      key={bucket.hostname}
    />
  ));
};

export default Buckets;
