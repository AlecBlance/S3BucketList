import { beforeEach, describe, it, expect } from "vitest";
import { hasListBucketPermission, getBucketInfo } from "./info";

describe("bucket info", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("should be able to detect ListBucket permission", async () => {
    expect(await hasListBucketPermission("aneta.s3.amazonaws.com")).toEqual({
      ListBucket: true,
    });

    await expect(async () => {
      await hasListBucketPermission("test.cloud.s3.amazonaws.com");
    }).rejects.toThrowError("Failed to fetch list bucket permissions");
  });

  it("should be able to extract bucket information", async () => {
    const bucketInfo = await getBucketInfo("aneta.s3.amazonaws.com");
    expect(bucketInfo).toMatchObject({
      public: true,
      hostname: "aneta.s3.amazonaws.com",
      owner: "c7f6e5706fc415058cb9f4d41107a24191a94f1b79dbce9cd9a516925d718c1d",
      permissions: { ListBucket: true },
    });
    expect(typeof bucketInfo.date).toBe("number");
  });
});
