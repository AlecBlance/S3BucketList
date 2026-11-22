import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBuckets, exportBuckets } from "./download";
import { fakeIBucketInfo } from "@/_test/index.config";

describe("bucket downloads", () => {
  it("keeps site history and internal record IDs out of downloads", () => {
    const exported = exportBuckets([
      {
        ...fakeIBucketInfo,
        recordId: "local-id",
        initiator: "https://private-app.example",
        notes: "Private review notes",
        reviewStatus: "reported",
        observations: {
          firstSeen: 1,
          lastSeen: 2,
          sightings: 3,
          sources: ["https://private-app.example"],
          endpoints: ["https://bucket.example"],
          signedUrl: false,
        },
      },
    ]);
    expect(exported[0]).not.toHaveProperty("observations");
    expect(exported[0]).not.toHaveProperty("initiator");
    expect(exported[0]).not.toHaveProperty("recordId");
    expect(exported[0]).not.toHaveProperty("notes");
    expect(exported[0]).not.toHaveProperty("reviewStatus");
    expect(exported[0]).not.toHaveProperty("public");
    expect(exported[0]).not.toHaveProperty("claimed");
    expect(JSON.stringify(exported)).not.toContain("private-app.example");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does nothing when the filtered list is empty", () => {
    const createUrl = vi.spyOn(URL, "createObjectURL");
    expect(() => downloadBuckets([])).not.toThrow();
    expect(createUrl).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "downloads a nonempty list with public=%s",
    (isPublic) => {
      const anchor = {
        href: "",
        download: "",
        click: vi.fn(),
        remove: vi.fn(),
      };
      const appendChild = vi.fn();
      vi.stubGlobal("document", {
        createElement: vi.fn(() => anchor),
        body: { appendChild },
      });
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:download");
      const revoke = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => {});
      downloadBuckets([{ ...fakeIBucketInfo, public: isPublic }]);
      expect(anchor.download).toBe("buckets.json");
      expect(anchor.click).toHaveBeenCalledOnce();
      expect(anchor.remove).toHaveBeenCalledOnce();
      expect(revoke).toHaveBeenCalledWith("blob:download");
    },
  );
});
