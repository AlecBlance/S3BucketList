import { beforeEach, describe, it, expect } from "vitest";
import { hasListBucketPermission, getBucketInfo } from "./info";

describe("bucket info", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("should be able to detect ListBucket permission", async () => {
    expect(
      await hasListBucketPermission("flaws.cloud.s3.amazonaws.com")
    ).toEqual({
      ListBucket: true,
    });

    await expect(async () => {
      await hasListBucketPermission("test.cloud.s3.amazonaws.com");
    }).rejects.toThrowError("Failed to fetch list bucket permissions");
  });

  it("should be able to extract bucket information", async () => {
    const bucketInfo = await getBucketInfo("flaws.cloud.s3.amazonaws.com");
    expect(bucketInfo).toMatchObject({
      public: true,
      hostname: "flaws.cloud.s3.amazonaws.com",
      owner: undefined,
      owned: true,
      permissions: { ListBucket: true },
    });
    expect(typeof bucketInfo.date).toBe("number");
  });
});
