import type { IBucket } from "@/@types";
import { parseS3Url } from "./endpoints";
import { accessResult, scanRequest } from "./scanner";

/** Only an explicit, unsigned object URL for this identified bucket is accepted.
 * The URL and key exist in memory for the request only; neither is returned. */
export function objectTarget(bucket: IBucket, raw: string): string {
  if (typeof raw !== "string" || raw.length > 8192)
    throw new Error("Enter a direct, unsigned S3 file URL.");
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Enter a complete S3 file URL beginning with https://.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use an HTTPS file URL without credentials, query parameters, or a fragment. Signed URLs are not accepted.",
    );
  const expected = bucket.endpoint ?? parseS3Url(`https://${bucket.hostname}/`);
  const parsed = parseS3Url(url.href);
  if (
    !expected?.bucket ||
    !expected.apiUrl ||
    parsed?.key !== expected.key ||
    !parsed.object
  )
    throw new Error(
      "Use a file URL belonging to this bucket and AWS partition, not a CDN address or bucket root.",
    );
  const savedRoot = parseS3Url(expected.apiUrl);
  const root = savedRoot?.region
    ? savedRoot
    : parsed.region
      ? parsed
      : savedRoot;
  if (root?.key !== expected.key || !root?.apiUrl)
    throw new Error("The bucket API address is unavailable.");
  const path =
    parsed.kind === "path"
      ? url.pathname.split("/").slice(2).join("/")
      : url.pathname.slice(1);
  return root.apiUrl + path;
}

export async function checkObjectMetadata(
  bucket: IBucket,
  raw: string,
  signal?: AbortSignal,
) {
  const target = objectTarget(bucket, raw);
  const { trace } = await scanRequest(target, "object", "HEAD", signal);
  // HEAD success verifies metadata access only. It never downloads object bytes.
  return { check: accessResult(trace, trace.status === 200), trace };
}

/** Explicit opt-in content proof; no byte values or object identifiers escape. */
export async function checkObjectContent(
  bucket: IBucket,
  raw: string,
  signal?: AbortSignal,
) {
  const target = objectTarget(bucket, raw);
  const { trace } = await scanRequest(target, "content", "GET", signal);
  return { check: accessResult(trace, trace.reason === "confirmed"), trace };
}
