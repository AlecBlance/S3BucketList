import { beforeEach, describe, expect, it, vi } from "vitest";
import { addBadgeNumber } from "./badge";
import { fakeIBucketInfo } from "@/_test/index.config";
describe("attention badge", () => {
  beforeEach(() => fakeBrowser.reset());
  it("counts only unreviewed access evidence, not discovery volume or legacy public fields", async () => {
    const text = vi
      .spyOn(browser.action, "setBadgeText")
      .mockResolvedValue(undefined);
    const background = vi
      .spyOn(browser.action, "setBadgeBackgroundColor")
      .mockResolvedValue(undefined);
    await addBadgeNumber([
      { ...fakeIBucketInfo, public: true },
      { ...fakeIBucketInfo, access: { listing: { result: "allowed", at: 1 } } },
      {
        ...fakeIBucketInfo,
        reviewStatus: "expected",
        access: { listing: { result: "allowed", at: 1 } },
      },
      {
        ...fakeIBucketInfo,
        access: { file: { status: 200, at: 1, context: "browser" } },
      },
    ]);
    expect(text).toHaveBeenLastCalledWith({ text: "1" });
    expect(background).toHaveBeenLastCalledWith({ color: "green" });
    await addBadgeNumber([]);
    expect(text).toHaveBeenLastCalledWith({ text: "" });
  });
});
