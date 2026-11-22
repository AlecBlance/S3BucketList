import type { IBucket } from "@/@types";
import { reviewHelpKey } from "@/lib/bucket/triage";

export const discoveryStatuses = [
  ["listing", "Listing allowed"],
  ["acl", "Access rules readable"],
  ["file", "File access confirmed"],
  ["write-warning", "Public-write warning"],
  ["denied", "Listing and rules denied"],
  ["unclear", "Check unclear"],
  ["unknown-origin", "Origin bucket unknown"],
  ["missing", "Bucket not found"],
  ["unchecked", "Not checked"],
  ["observed", "Browser or signed link observed"],
  ["expected", "Marked expected"],
  ["in-progress", "Queued or checking"],
] as const;

export type DiscoveryStatus = (typeof discoveryStatuses)[number][0];

/** Group the visible row status, not permissions hidden by another status. */
export function discoveryStatus(bucket: IBucket): DiscoveryStatus {
  switch (reviewHelpKey(bucket)) {
    case "Can list":
      return "listing";
    case "ACL readable":
      return "acl";
    case "File metadata readable":
    case "File content readable":
      return "file";
    case "ACL reports public write access":
      return "write-warning";
    case "No anonymous listing or ACL access found":
      return "denied";
    case "Check failed":
      return "unclear";
    case "Bucket unknown":
      return "unknown-origin";
    case "Bucket not found":
      return "missing";
    case "File seen":
    case "Signed link seen":
      return "observed";
    case "Marked expected":
      return "expected";
    case "Checking…":
      return "in-progress";
    default:
      return "unchecked";
  }
}
