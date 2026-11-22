import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeIBucketInfo } from "@/_test/index.config";
import { tabDiscoveriesStorage } from "@/lib/storage";
import {
  acknowledgeTabDiscoveries,
  forgetTabDiscoveries,
  recentTabRows,
  recordTabDiscovery,
} from "./tab-discoveries";

describe("recent discoveries and unread counts per tab", () => {
  beforeEach(() => fakeBrowser.reset());
  const first = { ...fakeIBucketInfo, recordId: "first" };
  const second = {
    ...first,
    hostname: "other.s3.amazonaws.com",
    recordId: "other",
  };

  it("isolates counts across tabs and clears only the opened tab's badge", async () => {
    const text = vi
      .spyOn(browser.action, "setBadgeText")
      .mockResolvedValue(undefined);
    const background = vi
      .spyOn(browser.action, "setBadgeBackgroundColor")
      .mockResolvedValue(undefined);
    await Promise.all([
      recordTabDiscovery(
        12,
        first,
        "https://app.example/private?secret=fixture",
      ),
      recordTabDiscovery(24, first),
      recordTabDiscovery(12, first),
      recordTabDiscovery(12, second),
    ]);
    expect(text).toHaveBeenLastCalledWith({ tabId: 12, text: "2" });
    expect(text).toHaveBeenCalledWith({ tabId: 24, text: "1" });
    expect(background).toHaveBeenLastCalledWith({ tabId: 12, color: "green" });
    await acknowledgeTabDiscoveries(12);
    expect(text).toHaveBeenLastCalledWith({ tabId: 12, text: "" });
    await recordTabDiscovery(12, first);
    expect(text).toHaveBeenLastCalledWith({ tabId: 12, text: "" });
    const tabs = await tabDiscoveriesStorage.getValue();
    expect(tabs[12].map((item) => item.hostname)).toEqual([
      first.hostname,
      second.hostname,
    ]);
    expect(tabs[12][0].site).toBe("https://app.example");
    expect(tabs[24][0].unread).toBe(true);
    expect(JSON.stringify(tabs)).not.toMatch(/private|secret/);
  });

  it("forgets closed tabs and ignores background requests", async () => {
    await recordTabDiscovery(12, first);
    await recordTabDiscovery(-1, second);
    await forgetTabDiscoveries(12);
    expect(await tabDiscoveriesStorage.getValue()).toEqual({});
  });

  it("does not display a removed or replaced discovery", () => {
    expect(
      recentTabRows(
        [{ hostname: first.hostname, recordId: "removed", unread: true }],
        [first],
      ),
    ).toEqual([]);
  });
});
