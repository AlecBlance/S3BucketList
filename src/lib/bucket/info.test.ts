import { beforeEach, describe, it, expect, vi } from "vitest";
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

const { get, create } = vi.hoisted(() => {
  const get = vi.fn();
  return { get, create: vi.fn(() => ({ get })) };
});
vi.mock("axios", () => ({ default: { create } }));

describe("bucket info", () => {
  beforeEach(() => {
    fakeBrowser.reset();
    get.mockReset();
    get.mockImplementation(async (url: string) => ({
      data: url.endsWith("?acl") ? fakeAclData : fakeBucketData,
    }));
  });

  it("should be able to detect ListBucket permission", async () => {
    const cheerio = load(fakeBucketData);
    const noDataCheerio = load("Nothing");

    expect(hasListBucketPermission(cheerio)).toBeTruthy();
    expect(hasListBucketPermission(noDataCheerio)).toBeFalsy();
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

  it("should be able to check if bucket can be claimed", async () => {
    get.mockRejectedValue({
      response: {
        status: 404,
        data: "<Error><Code>NoSuchBucket</Code></Error>",
      },
    });
    const bucketInfo = await getBucketInfo("bhjsdfgkjn.s3.amazonaws.com");
    expect(bucketInfo.owned).toBeFalsy();
  });

  it("reports network failures without assuming an HTTP response exists", async () => {
    const error = new Error("Network Error");
    get.mockRejectedValue(error);
    await expect(
      getBucketInfo("example.s3.amazonaws.com"),
    ).rejects.toMatchObject({
      message: "Unable to inspect bucket example.s3.amazonaws.com",
      cause: error,
    });
  });

  it("does not mark a forbidden bucket as unclaimed", async () => {
    get.mockRejectedValue({
      response: {
        status: 403,
        data: "<Error><Code>AccessDenied</Code></Error>",
      },
    });
    expect(await getBucketInfo("example.s3.amazonaws.com")).toMatchObject({
      owned: true,
      public: false,
    });
  });

  it("uses a finite request timeout", () => {
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 15_000 }),
    );
  });
});
