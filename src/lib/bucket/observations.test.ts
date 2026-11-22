import { describe, expect, it } from "vitest";
import { observeBucket, safeOrigin } from "./observations";
import { matchesBucketFilter } from "./findings";
import { fakeIBucketInfo, s3Request } from "@/_test/index.config";
import type { IBucket } from "@/@types";

describe("local discovery history", () => {
  it("keeps only HTTP origins", () => {
    expect(
      safeOrigin(
        "https://user:password@example.com:8443/private?token=secret#fragment",
      ),
    ).toBe("https://example.com:8443");
    for (const value of [
      "null",
      "admin",
      "file:///secret",
      "chrome-extension://id",
      undefined,
    ]) {
      expect(safeOrigin(value)).toBeUndefined();
    }
  });

  it("tracks dates, sources, endpoints, status, and signing without storing URLs", () => {
    const first = observeBucket(
      fakeIBucketInfo,
      {
        ...s3Request,
        initiator: "https://app.example/account?token=source-secret",
        url: "https://sample.s3.amazonaws.com/private/document?X-Amz-Signature=url-secret",
      },
      200000,
    );
    const second = observeBucket(
      first,
      {
        ...s3Request,
        initiator: "https://other.example/invoices",
        url: "https://sample.s3.us-east-1.amazonaws.com/other",
        statusCode: 200,
      },
      300000,
    );
    expect(second.observations).toEqual({
      firstSeen: fakeIBucketInfo.date,
      lastSeen: 300000,
      sightings: 2,
      sources: ["https://app.example", "https://other.example"],
      endpoints: [
        "https://sample.s3.amazonaws.com",
        "https://sample.s3.us-east-1.amazonaws.com",
      ],
      lastStatus: 200,
      signedUrl: false,
    });
    expect(first.observations?.signedUrl).toBe(true);
    const saved = JSON.stringify([first, second]);
    for (const secret of [
      "source-secret",
      "url-secret",
      "/private/document",
      "/account",
      "/invoices",
    ]) {
      expect(saved).not.toContain(secret);
    }
  });

  it("deduplicates origins and bounds local history to 20 entries", () => {
    let bucket: IBucket = fakeIBucketInfo;
    for (let i = 0; i < 30; i++) {
      bucket = observeBucket(
        bucket,
        {
          ...s3Request,
          initiator: `https://site-${i}.example/page`,
        },
        200000 + i,
      );
    }
    bucket = observeBucket(
      bucket,
      { ...s3Request, initiator: "https://site-29.example/again" },
      300000,
    );
    expect(bucket.observations?.sources).toHaveLength(20);
    expect(bucket.observations?.endpoints).toHaveLength(1);
    expect(bucket.observations?.sightings).toBe(31);
  });

  it("keeps incomplete checks visible and supports old records", () => {
    for (const checkStatus of ["pending", "checking", "failed"] as const) {
      expect(
        matchesBucketFilter(
          { ...fakeIBucketInfo, public: true, checkStatus },
          "unchecked",
        ),
      ).toBe(true);
    }
    expect(matchesBucketFilter(fakeIBucketInfo, "all")).toBe(true);
    expect(
      matchesBucketFilter({ ...fakeIBucketInfo, public: true }, "listing"),
    ).toBe(false);
  });
});
