import { describe, expect, it, vi } from "vitest";
import { runtimeHandler } from "./runtime-handler";

describe("Chrome runtime response channel", () => {
  it("returns true synchronously and responds through the callback after async work", async () => {
    let finish!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    const handle = vi.fn(() => pending);
    const reply = vi.fn();
    const listener = runtimeHandler(handle);
    const message = {
      workspace: 1,
      command: {
        type: "buckets:queue",
        hostnames: ["sample.s3.amazonaws.com"],
      },
    };
    expect(listener(message, {}, reply)).toBe(true);
    expect(reply).not.toHaveBeenCalled();
    await Promise.resolve();
    finish({ ok: true, value: { queued: 1, skipped: 0 } });
    await vi.waitFor(() =>
      expect(reply).toHaveBeenCalledWith({
        ok: true,
        value: { queued: 1, skipped: 0 },
      }),
    );
  });
  it("does not claim messages intended for another listener", () => {
    const handle = vi.fn();
    const reply = vi.fn();
    expect(runtimeHandler(handle)({ other: true }, {}, reply)).toBeUndefined();
    expect(handle).not.toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
  });
  it("responds on errors without exposing raw errors or hanging the channel", async () => {
    const reply = vi.fn();
    expect(
      runtimeHandler(async () => {
        throw new Error("private details");
      })({ workspace: 1 }, {}, reply),
    ).toBe(true);
    await vi.waitFor(() => expect(reply).toHaveBeenCalledOnce());
    expect(reply.mock.calls[0][0].ok).toBe(false);
    expect(JSON.stringify(reply.mock.calls)).not.toContain("private details");
  });
});
