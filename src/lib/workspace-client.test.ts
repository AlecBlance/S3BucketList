import { afterEach, describe, expect, it, vi } from "vitest";
import { sendCommand } from "./workspace-client";
afterEach(() => vi.restoreAllMocks());
describe("workspace messaging", () => {
  it("returns the queue acknowledgement instead of waiting for S3 requests", async () => {
    const send = vi
      .spyOn(browser.runtime, "sendMessage")
      .mockResolvedValue({ ok: true, value: { queued: 1, skipped: 0 } });
    await expect(
      sendCommand({
        type: "buckets:queue",
        hostnames: ["sample.s3.amazonaws.com"],
      }),
    ).resolves.toEqual({ queued: 1, skipped: 0 });
    expect(send).toHaveBeenCalledOnce();
  });
  it.each([
    "Could not establish connection. Receiving end does not exist.",
    "Extension context invalidated.",
    "The message port closed before a response was received.",
  ])(
    "explains how to recover from %s without replaying an action",
    async (error) => {
      const send = vi
        .spyOn(browser.runtime, "sendMessage")
        .mockRejectedValue(new Error(error));
      await expect(
        sendCommand({
          type: "buckets:queue",
          hostnames: ["sample.s3.amazonaws.com"],
        }),
      ).rejects.toThrow("reload S3BucketList");
      expect(send).toHaveBeenCalledOnce();
    },
  );
  it("preserves background validation errors", async () => {
    vi.spyOn(browser.runtime, "sendMessage").mockResolvedValue({
      ok: false,
      error: "Extension pages only.",
    });
    await expect(
      sendCommand({ type: "jobs:cancel", id: "job" }),
    ).rejects.toThrow("Extension pages only.");
  });
});
