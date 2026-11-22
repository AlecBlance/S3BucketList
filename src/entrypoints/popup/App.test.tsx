import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PopupView } from "./App";
import { fakeIBucketInfo } from "@/_test/index.config";
import { load } from "cheerio";
describe("focused popup", () => {
  it("shows recent discoveries for this tab regardless of review status", () => {
    const buckets = [
      { ...fakeIBucketInfo, hostname: "cdn.example" },
      {
        ...fakeIBucketInfo,
        hostname: "expected.example",
        reviewStatus: "expected" as const,
        access: { listing: { result: "allowed" as const, at: 1 } },
      },
      {
        ...fakeIBucketInfo,
        hostname: "review.example",
        initiator: "https://app.example/path?token=secret",
        access: { listing: { result: "allowed" as const, at: 1 } },
      },
    ];
    const html = renderToStaticMarkup(
      <PopupView
        buckets={buckets}
        discoveries={[
          {
            hostname: "review.example",
            site: "https://app.example",
            unread: false,
          },
          { hostname: "expected.example", unread: false },
        ]}
        recording
        open={vi.fn()}
        toggle={vi.fn()}
      />,
    );
    expect(html).toContain("review.example");
    expect(html).toContain("https://app.example");
    expect(html).toContain("Listing request allowed");
    expect(html).toContain("This tab");
    expect(html).toContain("clears this tab’s badge");
    expect(html).toContain("Marked expected");
    expect(html).not.toMatch(
      /cdn\.example|token=secret|Extract page|Search buckets/,
    );
    expect(html).toContain("View all discoveries");
    expect(html).toContain('src="/icon.svg"');
    const $ = load(html, { xml: true });
    const row = $(".popup-bucket-item").first();
    expect(row.find(".popup-bucket-row").attr("aria-label")).toBe(
      "View review.example",
    );
    expect(row.find(".popup-bucket-row").attr("aria-describedby")).toBe(
      row.find(".popup-statuses").attr("id"),
    );
    expect(row.find(".popup-bucket-row button")).toHaveLength(0);
    expect(row.find(".status-info-button")).toHaveLength(1);
    expect(row.find(".status-with-help").attr("data-tone")).toBe("allowed");
  });

  it("keeps the dashboard reachable when this tab has no discoveries", () => {
    const html = renderToStaticMarkup(
      <PopupView
        buckets={[fakeIBucketInfo]}
        discoveries={[]}
        recording={false}
        open={vi.fn()}
        toggle={vi.fn()}
      />,
    );
    expect(html).toContain("No discoveries in this tab");
    expect(html).toContain("Recording is paused");
    expect(html).toContain("View all discoveries");
    expect(html).not.toContain(fakeIBucketInfo.hostname);
  });
});
