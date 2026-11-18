import { IBucket } from "@/@types";
import useBucket from "@/lib/store/useBucket.store";
import { bucketsStorage } from "@/lib/storage";
import { downloadBuckets } from "@/lib/bucket/download";

const Actions = ({ buckets }: { buckets: IBucket[] }) => {
  const { buckets: bucketsState, setBuckets } = useBucket((state) => state);

  const removeAllBuckets = (hostnames: string[]) => {
    const updatedBuckets = bucketsState.filter(
      (bucket) => !hostnames.includes(bucket.hostname),
    );
    setBuckets(updatedBuckets);
    bucketsStorage.setValue(updatedBuckets);
  };

  return (
    <div className="flex items-center justify-between">
      <p>
        Total of <b>{buckets.length}</b> buckets
      </p>
      <div className="flex items-center space-x-2">
        <button
          onClick={() =>
            removeAllBuckets(buckets.map((bucket) => bucket.hostname))
          }
          className="hover:text-primary cursor-pointer"
        >
          Remove All ({buckets.length})
        </button>
        <p>-</p>
        <button
          className="hover:text-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          disabled={buckets.length === 0}
          onClick={() => downloadBuckets(buckets)}
        >
          Download
        </button>
      </div>
    </div>
  );
};

export default Actions;
