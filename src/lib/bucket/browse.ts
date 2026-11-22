import type { IBucket, IScanAttempt } from "@/@types";
import { parseS3Url } from "./endpoints";
import { rootName, scanRequest } from "./scanner";
import { objectTarget } from "./object-check";

export interface ObjectPreview {
  objects: { key: string; url: string }[];
  truncated: boolean;
  trace: IScanAttempt;
}
export const PREVIEW_LIMIT = 20;

/** One page only. Returned keys are transient UI data, never scan evidence. */
export async function browseObjects(
  bucket: IBucket,
  prefix: string,
  signal?: AbortSignal,
): Promise<ObjectPreview> {
  if (typeof prefix !== "string" || prefix.length > 1024)
    throw new Error("Use a prefix of at most 1024 characters.");
  const endpoint = bucket.endpoint ?? parseS3Url(`https://${bucket.hostname}/`);
  if (!endpoint?.apiUrl || !endpoint.bucket)
    throw new Error("Bucket API unavailable.");
  const query = new URLSearchParams({
    "list-type": "2",
    "max-keys": String(PREVIEW_LIMIT),
    "encoding-type": "url",
    prefix,
  });
  const { xml, trace } = await scanRequest(
    endpoint.apiUrl + "?" + query,
    "browse",
    "GET",
    signal,
  );
  const empty = { objects: [], truncated: false, trace };
  if (trace.reason !== "confirmed") return empty;
  if (!xml || rootName(xml) !== "ListBucketResult") {
    trace.reason = "unexpected";
    return empty;
  }
  const children = xml.root().children().first().children();
  const named = (name: string) =>
    children.filter(
      (_, el) => "name" in el && el.name.split(":").at(-1) === name,
    );
  const contents = named("Contents");
  if (
    named("Name").text() !== endpoint.bucket ||
    named("EncodingType").text() !== "url" ||
    contents.length > PREVIEW_LIMIT
  ) {
    trace.reason = "unexpected";
    return empty;
  }
  try {
    if (decodeURIComponent(named("Prefix").text()) !== prefix)
      throw new Error();
    const objects = contents.toArray().map((el) => {
      const keys = xml(el)
        .children()
        .filter(
          (_, child) =>
            "name" in child && child.name.split(":").at(-1) === "Key",
        );
      if (keys.length !== 1) throw new Error();
      const key = decodeURIComponent(keys.text());
      if (!key || !key.startsWith(prefix)) throw new Error();
      // Encode each segment, not slashes; refuse URL-normalized dot segments.
      if (key.split("/").some((part) => part === "." || part === ".."))
        throw new Error();
      const url = objectTarget(
        bucket,
        endpoint.apiUrl! + key.split("/").map(encodeURIComponent).join("/"),
      );
      return { key, url };
    });
    return {
      objects,
      truncated: named("IsTruncated").text() === "true",
      trace,
    };
  } catch {
    trace.reason = "unexpected";
    return empty;
  }
}
