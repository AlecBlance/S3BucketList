import { logger } from "./logger";

interface WatchedStorage<T> {
  getValue(): Promise<T>;
  watch(callback: (value: T) => void): () => void;
}

/**
 * Subscribe before reading so a slow initial read cannot overwrite a newer event.
 */
export const subscribeStorage = <T>(
  item: WatchedStorage<T>,
  onValue: (value: T) => void,
): (() => void) => {
  let active = true;
  let changed = false;
  const unwatch = item.watch((value) => {
    changed = true;
    if (active) onValue(value);
  });
  void item
    .getValue()
    .then((value) => {
      if (active && !changed) onValue(value);
    })
    .catch((error) => logger("Failed to load storage:", error));

  return () => {
    active = false;
    unwatch();
  };
};
