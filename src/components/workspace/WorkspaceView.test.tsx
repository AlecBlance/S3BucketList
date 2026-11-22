import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import WorkspaceView, { WorkspaceActions } from "./WorkspaceView";
import { fakeIBucketInfo } from "@/_test/index.config";
import { load } from "cheerio";
const actions: WorkspaceActions = {
  select: vi.fn(),
  queue: vi.fn(),
  cancel: vi.fn(),
  remove: vi.fn(),
  removeMany: vi.fn(),
  save: vi.fn(),
  recording: vi.fn(),
  review: vi.fn(),
  verifyObject: vi.fn(),
  browseObjects: vi.fn(),
};
describe("workspace", () => {
  it("shows old access as earlier evidence and provides a clean endpoint link for identified buckets", () => {
    const bucket = {
      ...fakeIBucketInfo,
      hostname: "sample.s3.amazonaws.com",
      access: { listing: { result: "unknown" as const, at: 2 } },
      checkHistory: [
        {
          id: "first",
          at: 1,
          state: "checked" as const,
          listing: { result: "allowed" as const, at: 1 },
        },
      ],
    };
    const $ = load(
      renderToStaticMarkup(
        <WorkspaceView
          buckets={[bucket]}
          selected={bucket.hostname}
          initialView="all"
          jobs={[]}
          recording
          actions={actions}
        />,
      ),
    );
    expect($(".row-freshness").text()).toBe("Earlier access evidence");
    expect($(".endpoint-link").attr("href")).toBe(
      "https://s3.amazonaws.com/sample/",
    );
    expect($(".discovery-results").text()).toContain("Export shown");
  });
  it("shows live scan targets and outcomes outside More tools without a queued banner", () => {
    const buckets = ["active", "waiting", "finished"].map((name) => ({
      ...fakeIBucketInfo,
      hostname: `${name}.s3.amazonaws.com`,
      checkedAt: 1,
    }));
    const $ = load(
      renderToStaticMarkup(
        <WorkspaceView
          buckets={buckets}
          selected={buckets[0].hostname}
          jobs={buckets.map(({ hostname }, i) => ({
            id: hostname,
            hostname,
            state: (["running", "queued", "done"] as const)[i],
            attempts: 1,
            createdAt: 1,
            updatedAt: 2,
            reason: "manual",
          }))}
          initialView="all"
          recording
          actions={actions}
        />,
      ),
    );
    expect($(".scan-queue summary").text()).toContain("1 running · 1 waiting");
    expect($(".workspace-tools .scan-queue")).toHaveLength(0);
    expect($(".scan-queue [aria-label=Running]").text()).toContain(
      buckets[0].hostname,
    );
    expect($(".scan-queue [aria-label=Waiting]").text()).toContain(
      buckets[1].hostname,
    );
    expect($(".scan-queue [aria-label='Recent scans']").text()).toContain(
      "Completed",
    );
    expect($(".bucket-row").text()).toContain("Queued");
    expect($(".inspector .button.primary").text()).toContain("Checking…");
    expect($(".workspace-message")).toHaveLength(0);
  });
  it("visually distinguishes confirmed listing, unknown origin, and inconclusive checks", () => {
    const buckets = [
      {
        ...fakeIBucketInfo,
        hostname: "listed.s3.amazonaws.com",
        access: { listing: { result: "allowed" as const, at: 1 } },
      },
      {
        ...fakeIBucketInfo,
        hostname: "cdn.example",
        endpoint: {
          key: "custom:https://cdn.example",
          hostname: "cdn.example",
          kind: "custom" as const,
          object: false,
        },
      },
      {
        ...fakeIBucketInfo,
        hostname: "unclear.s3.amazonaws.com",
        access: { listing: { result: "unknown" as const, at: 1 } },
      },
    ];
    const $ = load(
      renderToStaticMarkup(
        <WorkspaceView
          buckets={buckets}
          jobs={[]}
          recording
          actions={actions}
          initialView="all"
        />,
      ),
      { xml: true },
    );
    const tones = Object.fromEntries(
      $(".bucket-row")
        .toArray()
        .map((row) => [
          $(row).find(".status-text").text(),
          $(row).find(".status-with-help").attr("data-tone"),
        ]),
    );
    expect(tones["Listing request allowed"]).toBe("allowed");
    expect(tones["Origin bucket unknown"]).toBe("identity");
    expect(tones["Check unclear"]).toBe("review");
    expect(new Set(Object.values(tones)).size).toBe(3);
  });
  it("provides a useful empty state and local-storage context", () => {
    const html = renderToStaticMarkup(
      <WorkspaceView buckets={[]} jobs={[]} recording actions={actions} />,
    );
    expect(html).toContain("Nothing needs review");
    expect(html).toContain("Stored on this device");
    expect(html).toContain("Check queue");
    expect(html).not.toContain("Details drawer");
  });
  it("renders operation-specific evidence without treating user notes as HTML", () => {
    const bucket = {
      ...fakeIBucketInfo,
      hostname: "sample.s3.amazonaws.com",
      notes: "<script>alert(1)</script>",
      access: {
        listing: { result: "allowed" as const, at: 1, status: 200 },
        acl: { result: "denied" as const, at: 1, status: 403 },
      },
    };
    const html = renderToStaticMarkup(
      <WorkspaceView
        buckets={[bucket]}
        selected={bucket.hostname}
        jobs={[]}
        recording
        actions={actions}
      />,
    );
    expect(html).toContain("Anonymous access");
    expect(html).toContain("Allowed");
    expect(html).toContain("Denied");
    expect(html).toContain("Export &amp; CLI commands");
    expect(html).not.toContain("<script>");
    const $ = load(html, { xml: true });
    expect(
      $(".bucket-tools > details > summary")
        .map((_, element) => $(element).text())
        .get(),
    ).toEqual([
      "Technical details",
      "Notes & review status",
      "Export & CLI commands",
      "Remove discovery",
    ]);
    const row = $(".bucket-row");
    expect(row.find(".bucket-row-main").attr("aria-current")).toBe("true");
    expect(row.find(".bucket-row-main").attr("aria-describedby")).toContain(
      "bucket-reason-",
    );
    expect(row.find(".bucket-row-main button")).toHaveLength(0);
    expect(row.find(".status-info-button")).toHaveLength(1);
    expect(row.find(".status-with-help").attr("data-tone")).toBe("allowed");
    expect($(".permission-result[data-tone=allowed]").text()).toContain(
      "Allowed",
    );
    expect($(".permission-result[data-tone=denied]").text()).toContain(
      "Denied",
    );
  });

  it("keeps unknown, file-only, expected, and missing-bucket leads out of the default collection", () => {
    const buckets = [
      {
        ...fakeIBucketInfo,
        hostname: "unknown.example",
        endpoint: {
          key: "custom:test",
          hostname: "unknown.example",
          kind: "custom" as const,
          object: false,
        },
      },
      {
        ...fakeIBucketInfo,
        hostname: "file-only.s3.amazonaws.com",
        access: { file: { at: 1, status: 200, context: "browser" as const } },
      },
      {
        ...fakeIBucketInfo,
        hostname: "expected.s3.amazonaws.com",
        reviewStatus: "expected" as const,
        access: { listing: { at: 1, result: "allowed" as const } },
      },
      {
        ...fakeIBucketInfo,
        hostname: "missing.s3.amazonaws.com",
        access: { listing: { at: 1, result: "missing" as const } },
      },
    ];
    const html = renderToStaticMarkup(
      <WorkspaceView buckets={buckets} jobs={[]} recording actions={actions} />,
    );
    for (const bucket of buckets) expect(html).not.toContain(bucket.hostname);
    const all = renderToStaticMarkup(
      <WorkspaceView
        buckets={buckets}
        initialView="all"
        jobs={[]}
        recording
        actions={actions}
      />,
    );
    for (const bucket of buckets) expect(all).toContain(bucket.hostname);
    const $ = load(all);
    expect($(".status-filter option[value=missing]").text()).toBe(
      "Bucket not found (1)",
    );
    expect($(".status-filter option[value=unknown-origin]").text()).toBe(
      "Origin bucket unknown (1)",
    );
    expect($(".status-filter option[value=expected]").text()).toBe(
      "Marked expected (1)",
    );
    expect(html).not.toContain("All statuses");
  });

  it("keeps advanced sections collapsed and shows the source and reason first", () => {
    const bucket = {
      ...fakeIBucketInfo,
      hostname: "listing.s3.amazonaws.com",
      access: { listing: { at: 1, result: "allowed" as const } },
      initiator: "https://app.example/path?secret=token",
    };
    const html = renderToStaticMarkup(
      <WorkspaceView
        buckets={[bucket]}
        selected={bucket.hostname}
        jobs={[]}
        recording
        actions={actions}
      />,
    );
    expect(html).toContain("Listing request allowed");
    expect(html).toContain("https://app.example");
    expect(html).not.toContain("secret=token");
    expect(html).toContain("Mark expected");
    expect(html).not.toMatch(/<details[^>]*\sopen(?:=|>)/);
    expect(html).not.toContain("workspace-sidebar");
  });
});
