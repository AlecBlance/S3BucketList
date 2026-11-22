import { describe, expect, it } from "vitest";
import { parseS3Url } from "./endpoints";
import { isReqBucket } from "./filter";
import { s3Request } from "@/_test/index.config";

describe("S3 endpoints", () => {
  it.each([
    ["https://demo.s3.amazonaws.com/key", "virtual", undefined, "aws"],
    [
      "https://demo.s3.us-east-1.amazonaws.com/key",
      "virtual",
      "us-east-1",
      "aws",
    ],
    [
      "https://demo.s3-us-west-2.amazonaws.com/key",
      "virtual",
      "us-west-2",
      "aws",
    ],
    [
      "https://demo.s3.dualstack.eu-west-1.amazonaws.com/key",
      "virtual",
      "eu-west-1",
      "aws",
    ],
    ["https://s3.amazonaws.com/demo/key", "path", undefined, "aws"],
    [
      "https://s3.eu-central-1.amazonaws.com/demo/key",
      "path",
      "eu-central-1",
      "aws",
    ],
    [
      "https://s3.dualstack.eu-west-1.amazonaws.com/demo/key",
      "path",
      "eu-west-1",
      "aws",
    ],
    [
      "http://demo.s3-website-us-east-1.amazonaws.com/key",
      "website",
      "us-east-1",
      "aws",
    ],
    [
      "http://demo.s3-website.eu-west-1.amazonaws.com/key",
      "website",
      "eu-west-1",
      "aws",
    ],
    [
      "https://demo.s3.cn-north-1.amazonaws.com.cn/key",
      "virtual",
      "cn-north-1",
      "aws-cn",
    ],
    [
      "https://demo.s3.us-gov-west-1.amazonaws.com/key",
      "virtual",
      "us-gov-west-1",
      "aws-us-gov",
    ],
    [
      "https://demo.s3-accelerate.amazonaws.com/key",
      "virtual",
      undefined,
      "aws",
    ],
    [
      "https://demo.s3-accelerate.dualstack.amazonaws.com/key",
      "virtual",
      undefined,
      "aws",
    ],
  ])("recognizes %s", (url, kind, region, partition) => {
    expect(parseS3Url(url)).toMatchObject({
      bucket: "demo",
      kind,
      region,
      partition,
      object: true,
    });
  });

  it("deduplicates address styles but not partitions", () => {
    expect(parseS3Url("https://s3.us-west-2.amazonaws.com/demo/key")?.key).toBe(
      parseS3Url("http://demo.s3-website.us-east-1.amazonaws.com/index.html")
        ?.key,
    );
    expect(
      parseS3Url("https://demo.s3.cn-north-1.amazonaws.com.cn/")?.key,
    ).not.toBe(parseS3Url("https://demo.s3.amazonaws.com/")?.key);
  });

  it("uses path addressing for dotted names and removes object paths and secrets", () => {
    const endpoint = parseS3Url(
      "https://user:password@my.bucket.s3.us-west-2.amazonaws.com/private/file?X-Amz-Signature=secret",
    );
    expect(endpoint).toMatchObject({
      bucket: "my.bucket",
      apiUrl: "https://s3.us-west-2.amazonaws.com/my.bucket/",
    });
    expect(JSON.stringify(endpoint)).not.toMatch(
      /password|private|Signature|secret/,
    );
  });

  it("does not mistake AWS-like hostnames, service roots, or access points for buckets", () => {
    for (const url of [
      "https://demo.s3.amazonaws.com.evil.example/key",
      "https://s3.us-west-2.amazonaws.com/",
      "https://name-123456789012.s3-accesspoint.us-east-1.amazonaws.com/key",
      "https://example.cloudfront.net/key",
    ])
      expect(parseS3Url(url)).toBeUndefined();
  });

  it("keeps custom/CDN names unresolved even when S3 response headers are present", () => {
    const endpoint = parseS3Url(
      "https://cdn.example/private?token=secret",
      true,
    );
    expect(endpoint).toMatchObject({ kind: "custom", hostname: "cdn.example" });
    expect(endpoint?.bucket).toBeUndefined();
    expect(endpoint?.apiUrl).toBeUndefined();
  });

  it("recognizes S3 URLs without response headers", () => {
    expect(isReqBucket({ ...s3Request, responseHeaders: [] })).toBe(true);
  });
});
