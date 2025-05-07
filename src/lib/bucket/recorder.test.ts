import { describe, it, expect, beforeEach } from "vitest";
import { cleanBucketUrl } from "./recorder";

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
});
