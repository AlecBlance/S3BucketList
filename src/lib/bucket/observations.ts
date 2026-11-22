import type { IBucket, IBucketObservations } from "@/@types";
import { parseS3Url } from "./endpoints";

// Store origins only: no object paths, credentials, query strings, or fragments.
export function safeOrigin(value?: string): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:")
      return url.origin;
  } catch {
    return;
  }
}

function appendOrigin(values: string[], value?: string): string[] {
  return [
    ...new Set(
      [...values.map(safeOrigin), value].filter(
        (origin): origin is string => !!origin,
      ),
    ),
  ].slice(-20);
}

export function observeBucket(
  bucket: IBucket,
  request: Browser.webRequest.WebResponseHeadersDetails,
  now: number,
): IBucket {
  const previous = bucket.observations;
  const url = new URL(request.url);
  const sources = previous?.sources ?? [bucket.initiator ?? ""];
  const observations: IBucketObservations = {
    firstSeen: previous?.firstSeen ?? bucket.date,
    lastSeen: Math.max(previous?.lastSeen ?? bucket.date, now),
    sightings: (previous?.sightings ?? 0) + 1,
    sources: appendOrigin(sources, safeOrigin(request.initiator)),
    endpoints: appendOrigin(previous?.endpoints ?? [], safeOrigin(request.url)),
    lastStatus: request.statusCode || undefined,
    // Record only that signing was observed, never the credentials themselves.
    signedUrl: [...url.searchParams.keys()].some((key) =>
      [
        "x-amz-signature",
        "signature",
        "x-amz-credential",
        "awsaccesskeyid",
      ].includes(key.toLowerCase()),
    ),
  };
  const fileSeen =
    parseS3Url(request.url)?.object &&
    request.method === "GET" &&
    [200, 206].includes(request.statusCode);
  return {
    ...bucket,
    initiator: observations.sources[0],
    observations,
    access: {
      ...bucket.access,
      signedLink: bucket.access?.signedLink || observations.signedUrl,
      ...(fileSeen
        ? {
            file: {
              at: now,
              status: request.statusCode,
              context: observations.signedUrl
                ? ("signed" as const)
                : ("browser" as const),
            },
          }
        : {}),
    },
  };
}
