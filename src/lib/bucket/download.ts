import type { IBucket } from "@/@types";

export const downloadBuckets = (buckets: IBucket[]): void => {
  if (buckets.length === 0) return;

  const data = JSON.stringify(buckets, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = `buckets-${buckets[0].public ? "public" : "private"}.json`;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
};
