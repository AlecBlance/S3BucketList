import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBuckets } from "./download";
import { fakeIBucketInfo } from "@/_test/index.config";

describe("bucket downloads", () => {
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
      expect(anchor.download).toBe(
        `buckets-${isPublic ? "public" : "private"}.json`,
      );
      expect(anchor.click).toHaveBeenCalledOnce();
      expect(anchor.remove).toHaveBeenCalledOnce();
      expect(revoke).toHaveBeenCalledWith("blob:download");
    },
  );
});
