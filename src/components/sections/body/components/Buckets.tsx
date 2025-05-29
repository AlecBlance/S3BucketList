"use client";

import { IBucket } from "@/@types";
import BucketCard from "./BucketCard";
import { useQuery } from "@tanstack/react-query";
import { buckets } from "@/lib/storage";
import useSearch from "@/lib/store/useSearch.store";

const Buckets = ({ tab }: { tab: string }) => {
  const { data = [] } = useQuery({
    queryKey: ["buckets"],
    queryFn: () => buckets.getValue(),
  });

  const filteredBuckets = data
    .filter((bucket) => bucket.public === (tab === "public"))
    .reverse();

  return <FilteredBucket buckets={filteredBuckets} />;
};

// Another component just for searching to avoid any async storage calls again.
function FilteredBucket({ buckets }: { buckets: IBucket[] }) {
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
}

export default Buckets;
