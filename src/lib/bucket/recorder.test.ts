import { describe, it, expect, beforeEach } from "vitest";
import { cleanBucketUrl, addToBucketStorage } from "./recorder";
import { IBucket } from "@/@types";
import { fakeIBucketInfo } from "@/_test/index.config";

describe("recorder", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("should clean bucket url", () => {
    const oldS3 = cleanBucketUrl("s3.amazonaws.com", "/test");
    const newS3 = cleanBucketUrl("aneta.s3.amazonaws.com", "/");
    const oldS3WithExtra = cleanBucketUrl("s3.amazonaws.com", "/test/test2");

    expect(oldS3).toBe("test.s3.amazonaws.com");
    expect(newS3).toBe("aneta.s3.amazonaws.com");
    expect(oldS3WithExtra).toBe("test.s3.amazonaws.com");
  });

  it("should store bucket info", async () => {
    await addToBucketStorage(fakeIBucketInfo);
    const bucketsList = (await fakeBrowser.storage.local.get("buckets"))
      .buckets as IBucket[];
    expect(bucketsList).toBeDefined();
    expect(bucketsList).toHaveLength(1);
    expect(bucketsList[0]).toMatchObject(fakeIBucketInfo);
  });
});
