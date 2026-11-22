import type { IBucket } from "@/@types";

export function findingLabels(bucket: IBucket): string[] {
  const labels: string[] = [];
  if (bucket.endpoint?.kind === "custom") labels.push("Bucket unknown");
  const { listing, acl, file, signedLink } = bucket.access ?? {};
  if (
    listing?.result === "missing" ||
    acl?.result === "missing" ||
    (!listing && !acl && !bucket.checkStatus && bucket.owned === false)
  )
    labels.push("Bucket not found");
  if (listing?.result === "allowed") labels.push("Can list");
  if (listing?.result === "denied") labels.push("Listing blocked");
  if (listing?.result === "unknown") labels.push("Listing unclear");
  if (acl?.result === "allowed") labels.push("ACL readable");
  if (acl?.result === "denied") labels.push("ACL blocked");
  if (acl?.result === "unknown") labels.push("ACL unclear");
  if (file) labels.push("File seen");
  if (signedLink) labels.push("Signed link seen");
  if (!listing && !acl && !bucket.checkStatus) labels.push("Older result");
  return labels;
}

export type BucketFilter = "all" | "listing" | "files" | "unchecked";
export function matchesBucketFilter(
  bucket: IBucket,
  filter: BucketFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "listing") return bucket.access?.listing?.result === "allowed";
  if (filter === "files") return !!bucket.access?.file;
  return (
    !bucket.access?.listing ||
    bucket.checkStatus === "pending" ||
    bucket.checkStatus === "checking" ||
    bucket.checkStatus === "failed"
  );
}
