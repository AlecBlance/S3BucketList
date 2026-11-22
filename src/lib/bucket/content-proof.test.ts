import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeIBucketInfo } from "@/_test/index.config";
import { parseS3Url } from "./endpoints";
import { checkObjectContent, checkObjectMetadata } from "./object-check";
import { browseObjects } from "./browse";
import {
  confirmedAccess,
  needsReview,
  reconcileReview,
  reviewReason,
} from "./triage";
import { evidenceRecord } from "./evidence";
import { appendCheck } from "./history";

const bucket = {
  ...fakeIBucketInfo,
  hostname: "sample.s3.amazonaws.com",
  endpoint: parseS3Url("https://sample.s3.eu-west-1.amazonaws.com/"),
};
const url = "https://sample.s3.amazonaws.com/PRIVATE-file.txt";
const request = vi.fn<typeof fetch>();
beforeEach(() => {
  request.mockReset();
  vi.stubGlobal("fetch", request);
});
afterEach(() => vi.unstubAllGlobals());

describe("anonymous content proof matrix", () => {
  it.each([
    ["readable range", 206, "x", "bytes 0-0/100", "allowed"],
    ["private or signed-only", 403, "", null, "denied"],
    ["missing", 404, "", null, "missing"],
    ["range ignored", 200, "file content", null, "unknown"],
    ["empty object", 416, "", null, "unknown"],
    ["wrong range", 206, "x", "bytes 1-1/100", "unknown"],
    ["oversized range body", 206, "xx", "bytes 0-0/100", "unknown"],
    ["empty range body", 206, "", "bytes 0-0/100", "unknown"],
    ["redirect", 307, "", null, "unknown"],
    ["throttled", 503, "", null, "unknown"],
    ["ambiguous success", 204, null, null, "unknown"],
  ])("%s", async (_, status, body, range, expected) => {
    request.mockResolvedValue(
      new Response(body, {
        status: Number(status),
        headers: range ? { "content-range": String(range) } : {},
      }),
    );
    const result = await checkObjectContent(bucket, url);
    expect(result.check.result).toBe(expected);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      "https://s3.eu-west-1.amazonaws.com/sample/PRIVATE-file.txt",
      expect.objectContaining({
        method: "GET",
        credentials: "omit",
        redirect: "manual",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        headers: { Range: "bytes=0-0" },
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE|file\.txt|file content/,
    );
    expect(result.trace.operation).toBe("content");
    expect(result.trace.endpoint).toBeUndefined();
  });
  it("cancels an ignored range without reading or retaining the body", async () => {
    const cancel = vi.fn();
    request.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(1024));
          },
          cancel,
        }),
        { status: 200 },
      ),
    );
    expect((await checkObjectContent(bucket, url)).check.result).toBe(
      "unknown",
    );
    expect(cancel).toHaveBeenCalled();
  });
  it("does not treat HEAD success as content evidence", async () => {
    request.mockResolvedValue(new Response(null, { status: 200 }));
    const result = await checkObjectMetadata(bucket, url);
    expect(result.check.result).toBe("allowed");
    expect(result.trace.operation).toBe("object");
    expect(
      confirmedAccess({ ...bucket, objectHead: result.check }).content,
    ).toBeUndefined();
  });
  it.each(["?X-Amz-Signature=secret", "?versionId=secret", "#fragment"])(
    "rejects %s without a request",
    async (suffix) => {
      await expect(checkObjectContent(bucket, url + suffix)).rejects.toThrow();
      expect(request).not.toHaveBeenCalled();
    },
  );
});

const listing = (keys: string[], extra = "", prefix = "private%2F") =>
  `<ListBucketResult><Name>sample</Name><EncodingType>url</EncodingType><Prefix>${prefix}</Prefix><IsTruncated>true</IsTruncated>${keys.map((key) => `<Contents><Key>${key}</Key></Contents>`).join("")}${extra}</ListBucketResult>`;
describe("scoped transient object browsing", () => {
  it("requests a single bounded page with the exact prefix and safely constructs file URLs", async () => {
    request.mockResolvedValue(
      new Response(listing(["private%2Fa%3F%23%20b.txt"])),
    );
    const result = await browseObjects(bucket, "private/");
    expect(request).toHaveBeenCalledTimes(1);
    const target = new URL(request.mock.calls[0][0] as string);
    expect(Object.fromEntries(target.searchParams)).toEqual({
      "list-type": "2",
      "max-keys": "20",
      "encoding-type": "url",
      prefix: "private/",
    });
    expect(result.objects).toEqual([
      {
        key: "private/a?# b.txt",
        url: "https://s3.eu-west-1.amazonaws.com/sample/private/a%3F%23%20b.txt",
      },
    ]);
    expect(result.truncated).toBe(true);
    expect(result.trace.endpoint).toBeUndefined();
    expect(JSON.stringify(result.trace)).not.toContain("private");
  });
  it.each([
    listing(["outside.txt"]),
    listing(["private%2F..%2Ffile"]),
    listing(["private%ZZ"]),
    listing(Array(21).fill("private%2Ffile")),
    listing(["private%2Ffile"]).replace("<Name>sample", "<Name>foreign"),
    listing(["private%2Ffile"]).replace(
      "<EncodingType>url",
      "<EncodingType>other",
    ),
    listing(["private%2Ffile"], "", "other%2F"),
    "<html>login</html>",
    "<ListBucketResult>",
  ])("rejects malformed or out-of-scope listings", async (body) => {
    request.mockResolvedValue(new Response(body));
    const result = await browseObjects(bucket, "private/");
    expect(result.objects).toEqual([]);
    expect(result.trace.reason).toBe("unexpected");
  });
  it("does not infer file access from a readable listing", async () => {
    request.mockResolvedValue(new Response(listing(["private%2Ffile"])));
    await browseObjects(bucket, "private/");
    expect(bucket).not.toHaveProperty("objectRead");
  });
});

describe("content evidence retention and redaction", () => {
  const allowed = { result: "allowed" as const, at: 10, status: 206 };
  it("reopens expected metadata-only records for new content proof, not another denial", () => {
    const previous = {
      ...bucket,
      reviewStatus: "expected" as const,
      objectHead: allowed,
    };
    const next = { ...previous, objectRead: allowed };
    expect(reconcileReview(previous, next).reviewStatus).toBe("todo");
    expect(needsReview({ ...next, reviewStatus: "todo" })).toBe(true);
    expect(reviewReason({ ...next, reviewStatus: "todo" })).toBe(
      "File content readable",
    );
    expect(
      reconcileReview(previous, {
        ...previous,
        objectRead: { result: "denied", at: 11 },
      }).reviewStatus,
    ).toBe("expected");
  });
  it("retains positive content evidence across history compaction and later file denials", () => {
    let history = appendCheck([], {
      id: "proof",
      at: 10,
      state: "checked",
      objectRead: allowed,
    });
    for (let i = 0; i < 60; i++)
      history = appendCheck(history, {
        id: String(i),
        at: i + 11,
        state: "checked",
        objectRead: { result: "denied", at: i + 11 },
      });
    expect(history).toHaveLength(50);
    expect(
      confirmedAccess({
        ...bucket,
        objectRead: { result: "denied", at: 100 },
        checkHistory: history,
      }).content,
    ).toBe("allowed");
  });
  it("exports the content result, but never injected paths or raw data", () => {
    const result = evidenceRecord({
      ...bucket,
      objectRead: { ...allowed, endpoint: url },
      checkHistory: [
        {
          id: "test",
          at: 10,
          state: "checked",
          objectRead: { ...allowed, endpoint: url },
          trace: [
            {
              operation: "content",
              method: "GET",
              endpoint: url,
              at: 10,
              durationMs: 1,
              reason: "confirmed",
            },
          ],
        },
      ],
    });
    expect(result.checks.objectContent?.result).toBe("allowed");
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
});
