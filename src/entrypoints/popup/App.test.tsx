import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PopupView } from "./App";
import { fakeIBucketInfo } from "@/_test/index.config";
import { load } from "cheerio";
describe("focused popup", () => {
  it("only lists attention-worthy evidence with its referring site and reason", () => {
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
      <PopupView buckets={buckets} recording open={vi.fn()} toggle={vi.fn()} />,
    );
    expect(html).toContain("review.example");
    expect(html).toContain("https://app.example");
    expect(html).toContain("Listing request allowed");
    expect(html).not.toMatch(
      /cdn\.example|expected\.example|token=secret|Extract page|Search buckets/,
    );
    expect(html).toContain("View all discoveries");
    expect(html).toContain('src="/icon.svg"');
    const $ = load(html, { xml: true });
    const row = $(".popup-bucket-item");
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
});
