import { describe, expect, it, vi } from "vitest";
import { subscribeStorage } from "./subscribeStorage";

describe("storage subscriptions", () => {
  const setup = () => {
    let listener: (value: string[]) => void = () => {};
    let resolve: (value: string[]) => void = () => {};
    const unwatch = vi.fn();
    const item = {
      getValue: () =>
        new Promise<string[]>((done) => {
          resolve = done;
        }),
      watch: (callback: typeof listener) => {
        listener = callback;
        return unwatch;
      },
    };
    const onValue = vi.fn();
    const cleanup = subscribeStorage(item, onValue);
    return {
      onValue,
      cleanup,
      unwatch,
      emit: (value: string[]) => listener(value),
      resolve,
    };
  };

  it("loads initial data and receives live updates", async () => {
    const test = setup();
    test.resolve(["initial"]);
    await Promise.resolve();
    expect(test.onValue).toHaveBeenLastCalledWith(["initial"]);
    test.emit(["new"]);
    expect(test.onValue).toHaveBeenLastCalledWith(["new"]);
    test.cleanup();
  });

  it("does not let a stale initial read overwrite a live update", async () => {
    const test = setup();
    test.emit(["new"]);
    test.resolve(["old"]);
    await Promise.resolve();
    expect(test.onValue).toHaveBeenCalledExactlyOnceWith(["new"]);
    test.cleanup();
  });

  it("unsubscribes and ignores pending reads after unmount", async () => {
    const test = setup();
    test.cleanup();
    test.resolve(["old"]);
    test.emit(["new"]);
    await Promise.resolve();
    expect(test.unwatch).toHaveBeenCalledOnce();
    expect(test.onValue).not.toHaveBeenCalled();
  });
});
