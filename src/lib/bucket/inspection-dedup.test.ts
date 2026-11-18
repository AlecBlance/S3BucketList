import { beforeEach, describe, expect, it, vi } from "vitest";
import { bucketRecorder } from "./recorder";
import { bucketsStorage } from "@/lib/storage";
import { fakeIBucketInfo, s3Request } from "@/_test/index.config";

const { getInfo } = vi.hoisted(() => ({ getInfo: vi.fn() }));
vi.mock("@/lib/bucket", () => ({
  isReqBucket: () => true,
  getBucketInfo: getInfo,
}));

describe("inspection deduplication", () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await bucketsStorage.setValue([]);
    getInfo.mockReset();
    getInfo.mockResolvedValue({
      ...fakeIBucketInfo,
      hostname: "sample.s3.amazonaws.com",
    });
  });

  it("shares one inspection across concurrent object requests", async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        bucketRecorder({
          ...s3Request,
          url: `${s3Request.url}/object-${index}`,
        }),
      ),
    );
    expect(getInfo).toHaveBeenCalledOnce();
    expect(await bucketsStorage.getValue()).toHaveLength(1);
  });

  it("does not inspect an already-recorded bucket again", async () => {
    await bucketRecorder(s3Request);
    await bucketRecorder(s3Request);
    expect(getInfo).toHaveBeenCalledOnce();
  });

  it("allows retrying a failed inspection", async () => {
    getInfo.mockRejectedValueOnce(new Error("Network Error"));
    await expect(bucketRecorder(s3Request)).rejects.toThrow("Network Error");
    await bucketRecorder(s3Request);
    expect(getInfo).toHaveBeenCalledTimes(2);
    expect(await bucketsStorage.getValue()).toHaveLength(1);
  });

  it("does not share inspections between distinct bucket hostnames", async () => {
    await bucketRecorder(s3Request);
    await bucketRecorder({
      ...s3Request,
      url: "https://another.s3.amazonaws.com/object",
    });
    expect(getInfo).toHaveBeenCalledTimes(2);
  });
});
