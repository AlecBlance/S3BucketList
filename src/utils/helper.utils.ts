import { IBucketType } from "@/types";

const storage = chrome.storage.local;

/**
 * This gets the local storage key value or the keys within the local storage key object
 *
 * @param storageKey Storage key to access or retrieve
 * @param keys Optional keys to retrieve from the storage key
 * @returns Promise of the storage key value
 */
export const getStorageKeyValue = async <T = Record<string, any>>(
  storageKey: string | string[],
  keys?: string[],
): Promise<T | T[]> => {
  const extractKey = (storageKey: string): Promise<T> =>
    new Promise((resolve) =>
      chrome.storage.local.get(storageKey).then((result) => {
        if (!Object.keys(result).length) return resolve({} as T);
        if (!keys) return resolve(result as T);
        resolve(
          keys.reduce(
            (accu, key) => ({ ...accu, [key]: result[storageKey][key] }),
            {} as T,
          ),
        );
      }),
    );
  if (Array.isArray(storageKey)) {
    return Promise.all(storageKey.map((key) => extractKey(key)));
  } else {
    return extractKey(storageKey);
  }
};

/**
 * This edits the local storage key value. Specially useful for editing specific key in the object or adding another key
 *
 * @param storageKey Storage key to edit
 * @param value The value for the storage key
 * @returns Promise of the updated storage key value
 */
export const editStorageKeyValue = async (
  storageKey: string,
  value: object,
) => {
  return new Promise((resolve) =>
    chrome.storage.local.get(storageKey).then((result) => {
      if (!Object.keys(result).length) result[storageKey] = value;
      const storageKeyValues = result[storageKey];
      Object.entries(value).forEach(
        ([key, value]: [string, any]) => (storageKeyValues[key] = value),
      );
      result[storageKey] = storageKeyValues;
      chrome.storage.local.set(result).then(() => resolve(storageKeyValues));
    }),
  );
};

/**
 * Changes the badge text to the number of buckets
 *
 * @param buckets list of buckets from the storage
 */
export const addNumber = async (buckets: IBucketType) => {
  const { lastSeen } = await storage.get("lastSeen");
  // We only care for the good buckets
  const bucketsListed =
    buckets.good.filter((bucket) => bucket.date > lastSeen.good).length + 1;
  chrome.action.setBadgeText({
    text: bucketsListed.toString(),
  });
  chrome.action.setBadgeBackgroundColor({
    color: "green",
  });
};
