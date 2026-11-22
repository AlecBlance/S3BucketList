import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BucketDetailsBody } from "./BucketDetails";
import { fakeIBucketInfo } from "@/_test/index.config";
vi.mock("webext-bridge/popup", () => ({ sendMessage: vi.fn() }));

describe("bucket details", () => {
  it("shows separate results and explains their limits in simple terms", () => {
    const html = renderToStaticMarkup(
      <BucketDetailsBody
        bucket={{
          ...fakeIBucketInfo,
          access: {
            listing: { result: "denied", at: 1, status: 403 },
            acl: { result: "allowed", at: 2, status: 200 },
            file: { at: 3, context: "signed", status: 200 },
            signedLink: true,
          },
        }}
      />,
    );
    expect(html).toContain("List files");
    expect(html).toContain("Read ACL");
    expect(html).toContain("not proof of public access");
    expect(html).toContain("does not mean files are private");
  });

  it("keeps notes escaped and identifies local-only storage", () => {
    const html = renderToStaticMarkup(
      <BucketDetailsBody
        bucket={{
          ...fakeIBucketInfo,
          notes: "<script>private note</script>",
          reviewStatus: "reported",
        }}
      />,
    );
    expect(html).toContain("&lt;script&gt;private note&lt;/script&gt;");
    expect(html).toContain("not included in downloads");
    expect(html).toContain("not a verified retest result");
  });
});
