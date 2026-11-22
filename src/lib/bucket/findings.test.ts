import { describe, expect, it } from "vitest";
import { findingLabels, matchesBucketFilter } from "./findings";
import { fakeIBucketInfo, s3Request } from "@/_test/index.config";
import { observeBucket } from "./observations";
import type { IBucket } from "@/@types";

describe("access labels", () => {
  it("does not describe denied listing as private when a file loaded", () => {
    const bucket = observeBucket(
      {
        ...fakeIBucketInfo,
        access: { listing: { result: "denied", at: 1 } },
      },
      { ...s3Request, url: `${s3Request.url}/image.png`, statusCode: 200 },
      2,
    );
    expect(findingLabels(bucket)).toEqual(["Listing blocked", "File seen"]);
    expect(bucket.access?.file?.context).toBe("browser");
    expect(matchesBucketFilter(bucket, "files")).toBe(true);
    expect(matchesBucketFilter(bucket, "listing")).toBe(false);
  });

  it("records signed downloads without claiming anonymous access", () => {
    const bucket = observeBucket(
      fakeIBucketInfo,
      {
        ...s3Request,
        url: `${s3Request.url}/file?X-Amz-Signature=private-token`,
        statusCode: 206,
      },
      2,
    );
    expect(bucket.access?.file?.context).toBe("signed");
    expect(findingLabels(bucket)).toContain("Signed link seen");
    expect(JSON.stringify(bucket)).not.toContain("private-token");
    expect(findingLabels(bucket)).not.toContain("Can list");
  });

  it("does not mark failed requests or bucket listings as file reads", () => {
    for (const request of [s3Request, { ...s3Request, statusCode: 200 }]) {
      expect(
        observeBucket(fakeIBucketInfo, request, 2).access?.file,
      ).toBeUndefined();
    }
  });

  it("a missing bucket is not an unclaimed or public bucket", () => {
    const bucket: IBucket = {
      ...fakeIBucketInfo,
      owned: false,
      access: {
        listing: { result: "missing", at: 1 },
        acl: { result: "missing", at: 1 },
      },
    };
    expect(findingLabels(bucket)).toEqual(["Bucket not found"]);
    expect(matchesBucketFilter(bucket, "listing")).toBe(false);
    expect(matchesBucketFilter(bucket, "all")).toBe(true);
  });

  it("keeps legacy booleans out of operation-specific labels", () => {
    expect(findingLabels({ ...fakeIBucketInfo, public: true })).toEqual([
      "Older result",
    ]);
    expect(matchesBucketFilter(fakeIBucketInfo, "unchecked")).toBe(true);
  });
});
