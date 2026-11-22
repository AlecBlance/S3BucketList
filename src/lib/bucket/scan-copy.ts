import type { ScanReason } from "@/@types";
export const SCAN_REASONS: Record<ScanReason, string> = {
  confirmed: "S3 returned the expected result.",
  denied: "This request was denied. It does not decide other permissions.",
  "missing-bucket":
    "S3 returned NoSuchBucket. This does not prove the name can be claimed.",
  "missing-object":
    "The file request returned 404. This is not a missing-bucket or takeover finding.",
  network:
    "No usable response. Possible causes include the network, TLS, browser restrictions, or the extension.",
  timeout: "Stopped after 8 seconds without a result.",
  cancelled: "Cancelled. Earlier evidence was kept.",
  throttled:
    "The service was busy or rate-limiting. This is not a permission denial.",
  "wrong-region":
    "S3 requested another endpoint. A retry is allowed only in a validated region in the same AWS partition.",
  unexpected:
    "The response was not the expected S3 result. HTTP success alone is not access evidence.",
  "too-large":
    "Stopped at the 64 KiB response limit. No response body was saved.",
  unsupported: "No known bucket API address. No guessed target was requested.",
};
