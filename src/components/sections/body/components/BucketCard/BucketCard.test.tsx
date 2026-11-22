import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BucketCard from "./BucketCard";
import { fakeIBucketInfo } from "@/_test/index.config";

vi.mock("./OptionsDropdown", () => ({ default: () => null }));
vi.mock("webext-bridge/popup", () => ({ sendMessage: vi.fn() }));

describe("discovery cards", () => {
  it.each([
    ["pending", "Not checked"],
    ["checking", "Checking"],
    ["checked", "Checked"],
    ["failed", "Check failed"],
  ] as const)("shows a simple label for %s", (checkStatus, label) => {
    const html = renderToStaticMarkup(
      <BucketCard {...fakeIBucketInfo} checkStatus={checkStatus} />,
    );
    expect(html).toContain(label);
  });

  it("does not show old permissions as a result of a failed check", () => {
    const html = renderToStaticMarkup(
      <BucketCard {...fakeIBucketInfo} owned={false} checkStatus="failed" />,
    );
    expect(html).not.toContain("ListBucket:");
    expect(html).not.toContain("Unclaimed");
  });

  it("shows local history without introducing new result labels for legacy records", () => {
    const html = renderToStaticMarkup(
      <BucketCard
        {...fakeIBucketInfo}
        observations={{
          firstSeen: 100,
          lastSeen: 200,
          sightings: 2,
          sources: ["https://app.example", "https://other.example"],
          endpoints: ["https://sample.s3.amazonaws.com"],
          signedUrl: true,
          lastStatus: 200,
        }}
      />,
    );
    expect(html).toContain("Details");
    expect(html).toContain("Seen");
    expect(html).not.toContain("Check failed");
  });
});
