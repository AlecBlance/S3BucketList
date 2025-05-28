"use client";

import { IBucket } from "@/@types";
import BucketCard from "./BucketCard";
import { useQuery } from "@tanstack/react-query";
import { buckets } from "@/lib/storage";

const Buckets = ({ tab }: { tab: string }) => {
  const { data = [] } = useQuery({
    queryKey: ["buckets"],
    queryFn: () => buckets.getValue(),
  });

  const filteredBuckets = data
    .filter((bucket) => bucket.public === (tab === "public"))
    .reverse();

  return filteredBuckets.map((bucket) => (
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
