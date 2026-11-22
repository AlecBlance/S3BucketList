import { describe, expect, it } from "vitest";
import { parseBucketInput } from "./targets";
describe("explicit bucket targets", () => {
  it.each([
    "sample-bucket",
    "s3://sample-bucket/",
    "https://sample-bucket.s3.amazonaws.com/",
    "sample-bucket.s3.amazonaws.com",
    "https://s3.eu-west-1.amazonaws.com/sample-bucket/",
  ])("recognizes %s without guessing another bucket name", (input) => {
    expect(parseBucketInput(input).key).toBe("aws:sample-bucket");
  });
  it("keeps AWS partitions separate", () => {
    expect(
      parseBucketInput("https://sample.s3.cn-north-1.amazonaws.com.cn/").key,
    ).toBe("aws-cn:sample");
    expect(
      parseBucketInput("https://sample.s3.us-gov-west-1.amazonaws.com/").key,
    ).toBe("aws-us-gov:sample");
  });
  it.each([
    "https://cdn.example/",
    "https://sample.s3.amazonaws.com/private",
    "https://sample.s3.amazonaws.com/?Signature=SECRET",
    "s3://sample/file",
    "s3://user:pass@sample/",
    "https://sample.s3.amazonaws.com/#frag",
    "https://sample.s3.amazonaws.com:8080/",
    "bucket with spaces",
    "",
    "https://sample--usw2-az1--x-s3.s3.us-west-2.amazonaws.com/",
  ])("rejects %s", (input) => {
    expect(() => parseBucketInput(input)).toThrow();
  });
});
