import { afterEach, describe, expect, it, vi } from "vitest";
import type { ICheckJob } from "@/@types";
import { fakeIBucketInfo } from "@/_test/index.config";
import { CheckQueue } from "./jobs";

function setup(initial: ICheckJob[] = [], runner = vi.fn(async () => {})) {
  let saved = initial;
  const queue = new CheckQueue({
    run: runner,
    startInterval: 10,
    timeout: 100,
    storage: {
      async getValue() {
        return structuredClone(saved);
      },
      async setValue(value) {
        saved = structuredClone(value);
      },
    },
  });
  return { queue, runner, saved: () => saved };
}
const bucket = (id: string) => ({
  ...fakeIBucketInfo,
  hostname: `${id}.s3.amazonaws.com`,
  recordId: id,
});
afterEach(() => vi.useRealTimers());

describe("persistent check queue", () => {
  it("does not stall the queue when the wall clock moves backwards", async () => {
    vi.useFakeTimers();
    const { queue, runner } = setup();
    const first = await queue.enqueue(bucket("one"), "manual");
    await vi.advanceTimersByTimeAsync(10);
    await first.finished;
    vi.setSystemTime(0);
    const second = await queue.enqueue(bucket("two"), "manual");
    await vi.advanceTimersByTimeAsync(20);
    expect(runner).toHaveBeenCalledTimes(2);
    await second.finished;
  });
  it("deduplicates and runs no more than two jobs concurrently", async () => {
    vi.useFakeTimers();
    const finish: (() => void)[] = [];
    const runner = vi.fn(
      () => new Promise<void>((resolve) => finish.push(resolve)),
    );
    const { queue, saved } = setup([], runner);
    const first = await queue.enqueue(bucket("one"), "manual");
    const duplicate = await queue.enqueue(bucket("one"), "auto");
    const second = await queue.enqueue(bucket("two"), "manual");
    const third = await queue.enqueue(bucket("three"), "manual");
    expect(first.id).toBe(duplicate.id);
    await vi.advanceTimersByTimeAsync(20);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(saved().filter((job) => job.state === "running")).toHaveLength(2);
    finish[0]();
    await vi.advanceTimersByTimeAsync(10);
    expect(runner).toHaveBeenCalledTimes(3);
    finish[1]();
    finish[2]();
    await Promise.all([first.finished, second.finished, third.finished]);
    expect(saved().every((job) => job.state === "done")).toBe(true);
  });

  it("cancels active work and never starts cancelled queued work", async () => {
    vi.useFakeTimers();
    const runner = vi.fn(
      (_job: ICheckJob, _signal: AbortSignal) => new Promise<void>(() => {}),
    );
    const { queue, saved } = setup([], runner);
    const first = await queue.enqueue(bucket("one"), "manual");
    const second = await queue.enqueue(bucket("two"), "manual");
    await queue.cancel(second.id);
    await queue.cancel(first.id);
    await vi.advanceTimersByTimeAsync(20);
    await expect(first.finished).rejects.toThrow("cancelled");
    await expect(second.finished).rejects.toThrow("cancelled");
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0][1].aborted).toBe(true);
    expect(saved().every((job) => job.state === "cancelled")).toBe(true);
  });

  it("times out without retrying failed work", async () => {
    vi.useFakeTimers();
    const { queue, runner, saved } = setup(
      [],
      vi.fn(() => new Promise<void>(() => {})),
    );
    const job = await queue.enqueue(bucket("one"), "manual");
    await vi.advanceTimersByTimeAsync(200);
    await expect(job.finished).rejects.toThrow("timed out");
    await queue.recover();
    expect(saved()[0].state).toBe("failed");
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("resumes interrupted work at most once, and forgets deleted bucket jobs", async () => {
    vi.useFakeTimers();
    const base: ICheckJob = {
      id: "old",
      hostname: bucket("one").hostname,
      recordId: "one",
      state: "running",
      attempts: 1,
      createdAt: 1,
      updatedAt: 1,
      reason: "manual",
    };
    const { queue, runner, saved } = setup([
      base,
      { ...base, id: "exhausted", hostname: "two", attempts: 2 },
    ]);
    await queue.recover();
    await vi.advanceTimersByTimeAsync(10);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(saved().find((job) => job.id === "exhausted")?.state).toBe("failed");
    expect(saved().find((job) => job.id === "old")?.attempts).toBe(2);
    await queue.cancelFor([base.hostname]);
    expect(saved().some((job) => job.hostname === base.hostname)).toBe(false);
  });
});
