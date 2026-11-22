import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PermissionResults from "./PermissionResults";
import RequestInspector from "./RequestInspector";
import { fakeIBucketInfo } from "@/_test/index.config";
describe("permission results", () => {
  it("explains each operation and does not label untested writes as safe", () => {
    const html = renderToStaticMarkup(
      <PermissionResults
        bucket={{
          ...fakeIBucketInfo,
          access: {
            listing: { result: "allowed", at: 1 },
            acl: { result: "denied", at: 1 },
          },
        }}
        verify={vi.fn()}
        browse={vi.fn()}
      />,
    );
    expect(html).toContain("List filenames");
    expect(html).toContain("Read bucket access rules");
    expect(html).toContain("Test a file");
    expect(html).not.toContain("Read a file");
    expect(html).not.toMatch(/Upload files|change rules|Requires a write test/);
    expect(html.match(/role="row"/g)).toHaveLength(2);
    expect(html).not.toContain("S3 returned one filename"); // Legacy checks did not retain this count.
  });
  it("shows only the file result that was actually tested", () => {
    const html = renderToStaticMarkup(
      <PermissionResults
        bucket={{
          ...fakeIBucketInfo,
          objectHead: { result: "allowed", at: 1 },
        }}
        verify={vi.fn()}
        browse={vi.fn()}
      />,
    );
    expect(html).toContain("Read a file&#x27;s metadata");
    expect(html).not.toContain("Read a file&#x27;s content");
    expect(html).not.toContain('id="file-test-url"');
  });
  it("separates reported write grants from effective write tests", () => {
    const html = renderToStaticMarkup(
      <PermissionResults
        bucket={{
          ...fakeIBucketInfo,
          access: {
            acl: {
              result: "allowed",
              at: 1,
              grants: {
                AllUsers: ["WRITE_ACP"],
                AuthenticatedUsers: ["WRITE"],
              },
            },
          },
        }}
        verify={vi.fn()}
        browse={vi.fn()}
      />,
    );
    expect(html).toContain("Everyone");
    expect(html).toContain("Any AWS account");
    expect(html).toContain("not a write test");
    expect(html).not.toContain("owner123");
  });
  it("shows a request trace without exposing object paths", () => {
    const html = renderToStaticMarkup(
      <RequestInspector
        bucket={{
          ...fakeIBucketInfo,
          scanTrace: [
            {
              operation: "listing",
              method: "GET",
              endpoint:
                "https://s3.amazonaws.com/sample/?list-type=2&max-keys=1",
              at: 1,
              durationMs: 10,
              status: 503,
              errorCode: "SlowDown",
              reason: "throttled",
            },
          ],
        }}
        notify={vi.fn()}
      />,
    );
    expect(html).toContain("Test file listing");
    expect(html).toContain("503");
    expect(html).toContain("SlowDown");
    expect(html).toContain("not a permission denial");
  });
});
