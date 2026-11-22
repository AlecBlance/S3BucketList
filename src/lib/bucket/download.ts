import type { IBucket } from "@/@types";
import { evidenceExport, evidenceRecord } from "./evidence";

export const exportBuckets = (buckets: IBucket[]) =>
  buckets.map((bucket) => evidenceRecord(bucket));

export function downloadText(
  filename: string,
  data: string,
  type = "text/plain",
) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

export const downloadBuckets = (buckets: IBucket[]): void => {
  if (buckets.length === 0) return;

  downloadText(
    "buckets.json",
    JSON.stringify(evidenceExport(buckets), null, 2),
    "application/json",
  );
};
