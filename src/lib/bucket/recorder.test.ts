import { describe, it, expect, beforeEach } from "vitest";
import {
  cleanBucketUrl,
  addToBucketStorage,
  removeFromBucketStorage,
} from "./recorder";
import { IBucket } from "@/@types";
import { fakeIBucketInfo } from "@/_test/index.config";
import { bucketsStorage } from "@/lib/storage";
import { vi } from "vitest";

describe("recorder", () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await bucketsStorage.setValue([]);
  });

  it("should clean bucket url", () => {
    const oldS3 = cleanBucketUrl("s3.amazonaws.com", "/test");
    const newS3 = cleanBucketUrl("aneta.s3.amazonaws.com", "/");
    const oldS3WithExtra = cleanBucketUrl("s3.amazonaws.com", "/test/test2");

    expect(oldS3).toBe("test.s3.amazonaws.com");
    expect(newS3).toBe("aneta.s3.amazonaws.com");
    expect(oldS3WithExtra).toBe("test.s3.amazonaws.com");
  });

  it("should clean regional bucket url", () => {
    const dottedRegional = cleanBucketUrl(
      "s3.us-east-1.amazonaws.com",
      "/my-bucket",
    );
    const dashedRegional = cleanBucketUrl(
      "s3-us-west-2.amazonaws.com",
      "/my-bucket",
    );
    const regionalWithExtra = cleanBucketUrl(
      "s3.eu-central-1.amazonaws.com",
      "/my-bucket/key",
    );
    const regionalWithRootPath = cleanBucketUrl(
      "s3.ap-southeast-1.amazonaws.com",
      "/",
    );

    expect(dottedRegional).toBe("my-bucket.s3.amazonaws.com");
    expect(dashedRegional).toBe("my-bucket.s3.amazonaws.com");
    expect(regionalWithExtra).toBe("my-bucket.s3.amazonaws.com");
    expect(regionalWithRootPath).toBe("s3.ap-southeast-1.amazonaws.com");
  });

  it("should store bucket info", async () => {
    await addToBucketStorage(fakeIBucketInfo);
    const bucketsList = (await fakeBrowser.storage.local.get("buckets"))
      .buckets as IBucket[];
    expect(bucketsList).toBeDefined();
    expect(bucketsList).toHaveLength(1);
    expect(bucketsList[0]).toMatchObject(fakeIBucketInfo);
  });

  it("preserves concurrent insertions and deduplicates hostnames", async () => {
    const second = { ...fakeIBucketInfo, hostname: "second.s3.amazonaws.com" };
    await Promise.all([
      addToBucketStorage(fakeIBucketInfo),
      addToBucketStorage(second),
      addToBucketStorage(fakeIBucketInfo),
    ]);
    expect(await bucketsStorage.getValue()).toEqual([fakeIBucketInfo, second]);
  });

  it("serializes deletions with insertions without losing unrelated records", async () => {
    await addToBucketStorage(fakeIBucketInfo);
    const second = { ...fakeIBucketInfo, hostname: "second.s3.amazonaws.com" };
    await Promise.all([
      addToBucketStorage(second),
      removeFromBucketStorage([fakeIBucketInfo.hostname]),
    ]);
    expect(await bucketsStorage.getValue()).toEqual([second]);
  });

  it("propagates write errors and allows later mutations to succeed", async () => {
    vi.spyOn(bucketsStorage, "setValue").mockRejectedValueOnce(
      new Error("Write failed"),
    );
    await expect(addToBucketStorage(fakeIBucketInfo)).rejects.toThrow(
      "Write failed",
    );
    await addToBucketStorage(fakeIBucketInfo);
    expect(await bucketsStorage.getValue()).toEqual([fakeIBucketInfo]);
    vi.restoreAllMocks();
  });
});
