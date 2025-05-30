import { IBucket } from "@/@types";
import useBucket from "@/lib/store/useBucket.store";
import { bucketsStorage } from "@/lib/storage";

const Actions = ({ buckets }: { buckets: IBucket[] }) => {
  const { buckets: bucketsState, setBuckets } = useBucket((state) => state);

  const removeAllBuckets = (hostnames: string[]) => {
    const updatedBuckets = bucketsState.filter(
      (bucket) => !hostnames.includes(bucket.hostname),
    );
    setBuckets(updatedBuckets);
    bucketsStorage.setValue(updatedBuckets);
  };

  const handleDownload = () => {
    if (buckets.length === 0) {
      alert("No buckets to download.");
    }
    const data = JSON.stringify(buckets, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `buckets-${buckets[0].public ? "public" : "private"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          className="hover:text-primary cursor-pointer"
          onClick={handleDownload}
        >
          Download
        </button>
      </div>
    </div>
  );
};

export default Actions;
