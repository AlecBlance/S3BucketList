import { beforeEach, describe, it, expect } from "vitest";
import {
  hasListBucketPermission,
  getBucketInfo,
  getACLPermissions,
  isPublic,
} from "./info";
import {
  fakeAclData,
  fakeBucketData,
  samplePermissions,
} from "@/_test/index.config";
import { load } from "cheerio";

describe("bucket info", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("should be able to detect ListBucket permission", async () => {
    expect(hasListBucketPermission(fakeBucketData)).toBeTruthy();
    expect(hasListBucketPermission("Nothing")).toBeFalsy();
  });

  it("should be able to extract ACL permissions", () => {
    const cheerio = load(fakeAclData);
    const permissions = getACLPermissions(cheerio);
    expect(permissions).toEqual(samplePermissions);
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

  it("should be able to check if bucket is public", async () => {
    const _public = isPublic(samplePermissions);
    expect(_public).toBeTruthy();
  });
});
