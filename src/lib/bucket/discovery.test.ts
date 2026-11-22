import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bucketRecorder,
  recoverInterruptedChecks,
  removeFromBucketStorage,
  retryBucketInspection,
  annotateBucket,
  savePageReferences,
  setBucketReview,
  addBucketTargets,
  verifyBucketObject,
  previewBucketObjects,
  cancelBucketChecks,
} from "./recorder";
import { bucketsStorage } from "@/lib/storage";
import { fakeIBucketInfo, s3Request } from "@/_test/index.config";

const { getInfo } = vi.hoisted(() => ({ getInfo: vi.fn() }));
vi.mock("@/lib/bucket", () => ({
  isReqBucket: () => true,
  getBucketInfo: getInfo,
}));

describe("save before checking", () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await bucketsStorage.setValue([]);
    getInfo.mockReset();
  });

  it("shows a discovery before its check finishes, preserving sightings during the check", async () => {
    let finish!: (value: typeof fakeIBucketInfo) => void;
    getInfo.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = bucketRecorder({
      ...s3Request,
      initiator: "https://app.example",
    });
    await vi.waitFor(() => expect(getInfo).toHaveBeenCalledOnce());
    const [saved] = await bucketsStorage.getValue();
    expect(saved).toMatchObject({
      hostname: "sample.s3.amazonaws.com",
      checkStatus: "checking",
    });
    const second = bucketRecorder({
      ...s3Request,
      initiator: "https://other.example",
    });
    await vi.waitFor(async () => {
      expect((await bucketsStorage.getValue())[0].observations?.sightings).toBe(
        2,
      );
    });
    finish(fakeIBucketInfo);
    await Promise.all([first, second]);
    const [checked] = await bucketsStorage.getValue();
    expect(checked.checkStatus).toBe("checked");
    expect(checked.hostname).toBe("sample.s3.amazonaws.com");
    expect(checked.date).toBe(saved.date);
    expect(checked.observations?.sources).toEqual([
      "https://app.example",
      "https://other.example",
    ]);
    expect(getInfo).toHaveBeenCalledOnce();
  });

  it("keeps failed discoveries and retries without adding a sighting", async () => {
    getInfo.mockRejectedValueOnce(new Error("Offline"));
    await expect(bucketRecorder(s3Request)).rejects.toThrow("Offline");
    const [failed] = await bucketsStorage.getValue();
    expect(failed.checkStatus).toBe("failed");
    expect(failed.permissions).toEqual({});
    getInfo.mockResolvedValueOnce(fakeIBucketInfo);
    await retryBucketInspection(failed.hostname);
    const [checked] = await bucketsStorage.getValue();
    expect(checked.checkStatus).toBe("checked");
    expect(checked.observations).toEqual(failed.observations);
    expect(checked.date).toBe(failed.date);
  });

  it("does not recreate a bucket deleted while a check is running", async () => {
    let finish!: (value: typeof fakeIBucketInfo) => void;
    getInfo.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const task = bucketRecorder(s3Request);
    await vi.waitFor(() => expect(getInfo).toHaveBeenCalledOnce());
    await removeFromBucketStorage(["sample.s3.amazonaws.com"]);
    finish(fakeIBucketInfo);
    await task;
    expect(await bucketsStorage.getValue()).toEqual([]);
  });

  it("does not apply an old check to a deleted and rediscovered bucket", async () => {
    let firstFinish!: (value: typeof fakeIBucketInfo) => void;
    let secondFinish!: (value: typeof fakeIBucketInfo) => void;
    getInfo
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            firstFinish = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            secondFinish = resolve;
          }),
      );
    const first = bucketRecorder(s3Request);
    await vi.waitFor(() => expect(getInfo).toHaveBeenCalledTimes(1));
    const [old] = await bucketsStorage.getValue();
    await removeFromBucketStorage([old.hostname]);
    const second = bucketRecorder(s3Request);
    await vi.waitFor(() => expect(getInfo).toHaveBeenCalledTimes(2));
    firstFinish(fakeIBucketInfo);
    await first;
    const [newBucket] = await bucketsStorage.getValue();
    expect(newBucket.recordId).not.toBe(old.recordId);
    expect(newBucket.checkStatus).toBe("checking");
    secondFinish(fakeIBucketInfo);
    await second;
    expect((await bucketsStorage.getValue())[0].checkStatus).toBe("checked");
  });

  it("keeps legacy records without automatically checking them again", async () => {
    await bucketsStorage.setValue([
      { ...fakeIBucketInfo, hostname: "sample.s3.amazonaws.com" },
    ]);
    await bucketRecorder(s3Request);
    expect(getInfo).not.toHaveBeenCalled();
    expect((await bucketsStorage.getValue())[0].observations?.sightings).toBe(
      1,
    );
  });

  it("recovers interrupted checks without new network requests", async () => {
    await bucketsStorage.setValue([
      { ...fakeIBucketInfo, checkStatus: "checking" },
    ]);
    await recoverInterruptedChecks();
    expect((await bucketsStorage.getValue())[0].checkStatus).toBe("pending");
    expect(getInfo).not.toHaveBeenCalled();
  });

  it("does not inspect a hostname that is not saved", async () => {
    await expect(retryBucketInspection("other.example")).rejects.toThrow(
      "Bucket not found",
    );
    expect(getInfo).not.toHaveBeenCalled();
  });

  it("merges multiple endpoint styles for the same bucket", async () => {
    getInfo.mockResolvedValue(fakeIBucketInfo);
    await bucketRecorder(s3Request);
    await bucketRecorder({
      ...s3Request,
      url: "https://s3.us-west-2.amazonaws.com/sample/file",
    });
    await bucketRecorder({
      ...s3Request,
      url: "http://sample.s3-website-us-west-2.amazonaws.com/index.html",
    });
    const buckets = await bucketsStorage.getValue();
    expect(buckets).toHaveLength(1);
    expect(buckets[0].observations?.sightings).toBe(3);
    expect(buckets[0].observations?.endpoints).toHaveLength(3);
    expect(getInfo).toHaveBeenCalledOnce();
    expect(buckets[0].endpoint?.region).toBe("us-west-2");
  });

  it("recognizes an older saved regional address without creating a duplicate", async () => {
    await bucketsStorage.setValue([
      { ...fakeIBucketInfo, hostname: "sample.s3.us-west-2.amazonaws.com" },
    ]);
    await bucketRecorder(s3Request);
    expect(await bucketsStorage.getValue()).toHaveLength(1);
    expect((await bucketsStorage.getValue())[0].endpoint?.key).toBe(
      "aws:sample",
    );
    expect(getInfo).not.toHaveBeenCalled();
  });

  it("uses a reported region without changing partitions", async () => {
    getInfo.mockResolvedValue(fakeIBucketInfo);
    await bucketRecorder({
      ...s3Request,
      responseHeaders: [{ name: "X-Amz-Bucket-Region", value: "eu-west-1" }],
    });
    expect(getInfo).toHaveBeenCalledWith(
      "sample.s3.amazonaws.com",
      "https://s3.eu-west-1.amazonaws.com/sample/",
      expect.any(AbortSignal),
    );
  });

  it("records an unresolved custom domain without guessing a bucket to inspect", async () => {
    await bucketRecorder({ ...s3Request, url: "https://cdn.example/file" });
    const [bucket] = await bucketsStorage.getValue();
    expect(bucket.endpoint?.kind).toBe("custom");
    expect(getInfo).not.toHaveBeenCalled();
  });

  it("preserves notes saved while a check is running", async () => {
    let finish!: (value: typeof fakeIBucketInfo) => void;
    getInfo.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const task = bucketRecorder(s3Request);
    await vi.waitFor(() => expect(getInfo).toHaveBeenCalledOnce());
    await annotateBucket(
      "sample.s3.amazonaws.com",
      "Expected image assets",
      "expected",
    );
    finish(fakeIBucketInfo);
    await task;
    expect((await bucketsStorage.getValue())[0]).toMatchObject({
      notes: "Expected image assets",
      reviewStatus: "expected",
    });
  });

  it("validates notes and does not recreate deleted buckets", async () => {
    await expect(
      annotateBucket("missing.example", "note", "todo"),
    ).resolves.toEqual([]);
    await expect(
      annotateBucket("missing.example", "x".repeat(4001), "todo"),
    ).rejects.toThrow("Invalid bucket notes");
    expect(await bucketsStorage.getValue()).toEqual([]);
  });

  it("saves page references without sending checks or storing tokens and object paths", async () => {
    await savePageReferences(
      [{ url: "https://sample.s3.amazonaws.com/", signed: true }],
      "https://app.example/private?token=SECRET",
    );
    const [saved] = await bucketsStorage.getValue();
    expect(saved.discovery).toBe("reference");
    expect(saved.observations?.sightings).toBe(0);
    expect(saved.observations?.references).toBe(1);
    expect(saved.access?.signedLink).toBe(true);
    expect(JSON.stringify(saved)).not.toMatch(/SECRET|\/private/);
    expect(getInfo).not.toHaveBeenCalled();
  });

  it("keeps known regions when a later global address is seen", async () => {
    getInfo.mockResolvedValue(fakeIBucketInfo);
    await bucketRecorder({
      ...s3Request,
      url: "https://sample.s3.eu-west-1.amazonaws.com/object",
    });
    await bucketRecorder(s3Request);
    expect((await bucketsStorage.getValue())[0].endpoint?.region).toBe(
      "eu-west-1",
    );
  });

  it("keeps 100 concurrent bucket discoveries without losing their history", async () => {
    getInfo.mockImplementation(async (hostname: string) => ({
      ...fakeIBucketInfo,
      hostname,
    }));
    vi.useFakeTimers();
    const tasks = Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        bucketRecorder({
          ...s3Request,
          url: `https://bucket-${index}.s3.amazonaws.com/object`,
          initiator: "https://app.example",
        }),
      ),
    );
    try {
      await vi.advanceTimersByTimeAsync(55_000);
      await tasks;
    } finally {
      vi.useRealTimers();
    }
    const buckets = await bucketsStorage.getValue();
    expect(buckets).toHaveLength(100);
    expect(getInfo).toHaveBeenCalledTimes(100);
    expect(
      buckets.every(
        (bucket) =>
          bucket.checkStatus === "checked" &&
          bucket.observations?.sightings === 1 &&
          bucket.observations.sources[0] === "https://app.example",
      ),
    ).toBe(true);
  });

  it("persists expected baselines, preserves notes on dismissal, and reopens only on confirmed access changes", async () => {
    const allowed = {
      ...fakeIBucketInfo,
      checkStatus: "checked",
      access: {
        listing: { result: "allowed", at: 1 },
        acl: { result: "denied", at: 1 },
      },
    };
    getInfo.mockResolvedValue(allowed);
    await bucketRecorder(s3Request);
    await annotateBucket(
      "sample.s3.amazonaws.com",
      "Intentional dataset",
      "todo",
    );
    await setBucketReview("sample.s3.amazonaws.com", "expected");
    let [saved] = await bucketsStorage.getValue();
    expect(saved.reviewBaseline).toEqual({ listing: "allowed", acl: "denied" });
    expect(saved.notes).toBe("Intentional dataset");
    await bucketRecorder(s3Request);
    expect(getInfo).toHaveBeenCalledTimes(1);
    await retryBucketInspection(saved.hostname);
    expect((await bucketsStorage.getValue())[0].reviewStatus).toBe("expected");
    getInfo.mockResolvedValueOnce({
      ...allowed,
      checkStatus: "failed",
      access: {
        listing: { result: "unknown", at: 2 },
        acl: { result: "unknown", at: 2 },
      },
    });
    await expect(retryBucketInspection(saved.hostname)).rejects.toThrow(
      "Check unclear",
    );
    expect((await bucketsStorage.getValue())[0].reviewStatus).toBe("expected");
    getInfo.mockResolvedValueOnce({
      ...allowed,
      access: {
        listing: { result: "allowed", at: 3 },
        acl: { result: "allowed", at: 3 },
      },
    });
    await retryBucketInspection(saved.hostname);
    [saved] = await bucketsStorage.getValue();
    expect(saved.reviewStatus).toBe("todo");
    expect(saved.notes).toBe("Intentional dataset");
    expect(saved.checkHistory).toHaveLength(4);
    expect(saved.reviewBaseline).toBeUndefined();
  });

  it("adds explicit targets without scanning, and deduplicates their address styles", async () => {
    expect(
      await addBucketTargets([
        "sample",
        "https://s3.eu-west-1.amazonaws.com/sample/",
        "https://sample.s3.cn-north-1.amazonaws.com.cn/",
      ]),
    ).toEqual({ added: 2 });
    const saved = await bucketsStorage.getValue();
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({
      discovery: "manual",
      checkStatus: "pending",
    });
    expect(getInfo).not.toHaveBeenCalled();
    await expect(
      addBucketTargets(["other", "https://cdn.example/"]),
    ).rejects.toThrow();
    expect(await bucketsStorage.getValue()).toHaveLength(2); // Validation is atomic.
  });

  it("stores only redacted file evidence, preserving concurrent notes and reopening new access", async () => {
    await addBucketTargets(["sample"]);
    let finish!: (response: Response) => void;
    const request = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", request);
    try {
      const task = verifyBucketObject(
        "sample.s3.amazonaws.com",
        "https://sample.s3.amazonaws.com/private-file.txt",
      );
      await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
      await annotateBucket(
        "sample.s3.amazonaws.com",
        "Do not lose this note",
        "expected",
      );
      finish(new Response(null, { status: 200 }));
      await task;
      const [saved] = await bucketsStorage.getValue();
      expect(saved.objectHead).toMatchObject({
        result: "allowed",
        status: 200,
      });
      expect(saved.notes).toBe("Do not lose this note");
      expect(saved.reviewStatus).toBe("todo");
      expect(JSON.stringify(saved)).not.toContain("private-file");
      expect(saved.checkHistory?.[0].trace?.[0].endpoint).toBeUndefined();
      expect(getInfo).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps previews transient and persists only redacted content proof", async () => {
    await addBucketTargets(["sample"]);
    await annotateBucket(
      "sample.s3.amazonaws.com",
      "Keep this note",
      "expected",
    );
    const before = await bucketsStorage.getValue();
    const request = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", request);
    try {
      request.mockResolvedValueOnce(
        new Response(
          "<ListBucketResult><Name>sample</Name><EncodingType>url</EncodingType><Prefix>PRIVATE%2F</Prefix><IsTruncated>false</IsTruncated><Contents><Key>PRIVATE%2Ffile.txt</Key></Contents></ListBucketResult>",
        ),
      );
      const preview = await previewBucketObjects(
        "sample.s3.amazonaws.com",
        "PRIVATE/",
      );
      expect(preview.objects).toHaveLength(1);
      expect(await bucketsStorage.getValue()).toEqual(before);
      request.mockResolvedValueOnce(
        new Response("x", {
          status: 206,
          headers: { "content-range": "bytes 0-0/100" },
        }),
      );
      await verifyBucketObject(
        "sample.s3.amazonaws.com",
        preview.objects[0].url,
        true,
      );
      const [saved] = await bucketsStorage.getValue();
      expect(saved.objectRead).toMatchObject({
        result: "allowed",
        status: 206,
      });
      expect(saved.objectHead).toBeUndefined();
      expect(saved.reviewStatus).toBe("todo");
      expect(saved.notes).toBe("Keep this note");
      expect(saved.checkHistory?.[0].trace?.[0]).toMatchObject({
        operation: "content",
        method: "GET",
      });
      expect(JSON.stringify(saved)).not.toContain("PRIVATE");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("cancels file tests when the discovery is removed", async () => {
    await addBucketTargets(["sample"]);
    const request = vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise<Response>((_, reject) => {
          options.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", request);
    try {
      const task = verifyBucketObject(
        "sample.s3.amazonaws.com",
        "https://sample.s3.amazonaws.com/file",
      );
      const rejected = expect(task).rejects.toThrow("cancelled");
      await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
      await cancelBucketChecks(["sample.s3.amazonaws.com"]);
      await removeFromBucketStorage(["sample.s3.amazonaws.com"]);
      await rejected;
      expect(await bucketsStorage.getValue()).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
