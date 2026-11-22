import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeIBucketInfo } from "@/_test/index.config";
import { checkObjectMetadata, objectTarget } from "./object-check";
import { parseS3Url } from "./endpoints";
const bucket = {
  ...fakeIBucketInfo,
  hostname: "sample.s3.amazonaws.com",
  endpoint: parseS3Url("https://sample.s3.eu-west-1.amazonaws.com/"),
};
const request = vi.fn<typeof fetch>();
beforeEach(() => {
  request.mockReset();
  vi.stubGlobal("fetch", request);
  request.mockResolvedValue(
    new Response(null, {
      status: 200,
      headers: { "x-amz-meta-private": "SECRET" },
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("explicit file metadata verification", () => {
  it("uses the known bucket region and HEAD without storing a key or response metadata", async () => {
    const result = await checkObjectMetadata(
      bucket,
      "https://sample.s3.amazonaws.com/private%20file.txt",
    );
    expect(request).toHaveBeenCalledWith(
      "https://s3.eu-west-1.amazonaws.com/sample/private%20file.txt",
      expect.objectContaining({
        method: "HEAD",
        credentials: "omit",
        redirect: "manual",
        cache: "no-store",
      }),
    );
    expect(result.check.result).toBe("allowed");
    expect(result.trace.operation).toBe("object");
    expect(JSON.stringify(result)).not.toMatch(/private|SECRET|\.txt/);
    expect(result.check.endpoint).toBeUndefined();
  });
  it.each([
    "https://sample.s3.amazonaws.com/file?X-Amz-Signature=SECRET",
    "https://sample.s3.amazonaws.com/file?versionId=SECRET",
    "https://sample.s3.amazonaws.com/file#fragment",
    "https://user:pass@sample.s3.amazonaws.com/file",
    "http://sample.s3.amazonaws.com/file",
    "https://other.s3.amazonaws.com/file",
    "https://sample.s3.cn-north-1.amazonaws.com.cn/file",
    "https://cdn.example/file",
    "https://sample.s3.amazonaws.com/",
    "https://s3.amazonaws.com/sample/",
    "https://127.0.0.1/file",
  ])("refuses %s before any request is sent", async (url) => {
    await expect(checkObjectMetadata(bucket, url)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it("accepts a path-style object only within the same bucket", () => {
    expect(
      objectTarget(bucket, "https://s3.amazonaws.com/sample/a/b.txt"),
    ).toBe("https://s3.eu-west-1.amazonaws.com/sample/a/b.txt");
  });
  it("uses a validated region in the file URL when the bucket region is not known yet", () => {
    const unknownRegion = {
      ...bucket,
      endpoint: parseS3Url("https://sample.s3.amazonaws.com/"),
    };
    expect(
      objectTarget(
        unknownRegion,
        "https://sample.s3.eu-west-1.amazonaws.com/file",
      ),
    ).toBe("https://s3.eu-west-1.amazonaws.com/sample/file");
  });
  it.each([403, 404, 500, 302])(
    "does not infer content access from HTTP %s",
    async (status) => {
      request.mockResolvedValue(new Response(null, { status }));
      const result = await checkObjectMetadata(
        bucket,
        "https://sample.s3.amazonaws.com/file",
      );
      expect(result.check.result).not.toBe("allowed");
      expect(result.check.reason).not.toBe("missing-bucket");
    },
  );
});
