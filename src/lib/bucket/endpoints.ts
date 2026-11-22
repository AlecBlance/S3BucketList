import type { IS3Endpoint } from "@/@types";

const regionPattern = "[a-z]{2}(?:-[a-z]+)+-\\d";
const validBucket = (value: string) =>
  /^[a-z0-9][a-z0-9._-]{1,253}[a-z0-9]$/.test(value);

/** Parse known S3 addresses, never infer an origin bucket from a CDN/custom name. */
export function parseS3Url(
  raw: string,
  s3Headers = false,
): IS3Endpoint | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return;
  }
  if (!["https:", "http:"].includes(url.protocol)) return;
  const host = url.hostname;
  const suffix = host.endsWith(".amazonaws.com.cn")
    ? "amazonaws.com.cn"
    : "amazonaws.com";
  const awsHost = host.endsWith(`.${suffix}`);
  const prefix = awsHost ? host.slice(0, -(suffix.length + 1)) : "";
  const service = new RegExp(
    `^s3(?:[.-](${regionPattern})|\\.dualstack\\.(${regionPattern}))?$`,
  ).exec(prefix);
  const website = new RegExp(`^(.+)\\.s3-website[.-](${regionPattern})$`).exec(
    prefix,
  );
  const virtual = new RegExp(
    `^(.+)\\.s3(?:[.-](${regionPattern})|\\.dualstack\\.(${regionPattern}))?$`,
  ).exec(prefix);
  const accelerated = /^(.+)\.s3-accelerate(?:\.dualstack)?$/.exec(prefix);
  let bucket: string | undefined;
  let region: string | undefined;
  let kind: IS3Endpoint["kind"] = "virtual";
  let object = false;
  if (service) {
    bucket = url.pathname.split("/")[1];
    region = service[1] ?? service[2];
    kind = "path";
    object = url.pathname.split("/").slice(2).join("/").length > 0;
  } else if (website) {
    bucket = website[1];
    region = website[2];
    kind = "website";
    object = url.pathname.length > 1;
  } else if (virtual || accelerated) {
    bucket = (virtual ?? accelerated)![1];
    region = virtual?.[2] ?? virtual?.[3];
    object = url.pathname.length > 1;
  }
  const invalidRegion =
    region &&
    (suffix.endsWith(".cn")
      ? !region.startsWith("cn-")
      : region.startsWith("cn-") || region.startsWith("us-iso"));
  if (
    bucket &&
    validBucket(bucket) &&
    !bucket.endsWith("--x-s3") &&
    !invalidRegion &&
    !url.port
  ) {
    const partition = suffix.endsWith(".cn")
      ? "aws-cn"
      : region?.startsWith("us-gov-")
        ? "aws-us-gov"
        : "aws";
    const hostname =
      partition === "aws-us-gov"
        ? `${bucket}.s3.${region}.${suffix}`
        : `${bucket}.s3.${suffix}`;
    const apiHost = `s3${region ? `.${region}` : ""}.${suffix}`;
    // Path addressing also works for dotted names without inventing a TLS hostname.
    const apiUrl = `https://${apiHost}/${bucket}/`;
    return {
      key: `${partition}:${bucket}`,
      hostname,
      kind,
      bucket,
      region,
      partition,
      apiUrl,
      object,
    };
  }
  if (s3Headers) {
    return {
      key: `custom:${url.origin}`,
      hostname: url.host,
      kind: "custom",
      object: false,
    };
  }
}
