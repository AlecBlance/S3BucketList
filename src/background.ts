import { getStorageKeyValue } from "@/utils/helper.utils";
import { recordBuckets } from "./lib/recorder";

const requests = chrome.webRequest.onHeadersReceived;
const storage = chrome.storage.local;

// To make async function work, and also the ability to remove listener
const dummyFunc = (detail: chrome.webRequest.WebResponseHeadersDetails) => {
  recordBuckets(detail);
};

const listener = async (toRecord: boolean) => {
  if (toRecord)
    requests.addListener(
      dummyFunc,
      {
        urls: ["<all_urls>"],
      },
      ["responseHeaders"],
    );
  else requests.removeListener(dummyFunc);
};

(async () => {
  const [{ buckets }, { record }] = (await getStorageKeyValue([
    "buckets",
    "record",
  ])) as Record<string, any>[];
  if (!buckets || !Object.keys(buckets).length) {
    storage.set({
      buckets: { good: [], bad: [], error: [] },
      record: true,
      lastSeen: { good: 0, bad: 0, error: 0 },
    });
  }
  listener(record ?? true);
})();

chrome.runtime.onMessage.addListener((toRecord: boolean) => {
  listener(toRecord);
  chrome.action.setBadgeText({
    text: toRecord ? "" : "!",
  });
  chrome.action.setBadgeBackgroundColor({
    color: toRecord ? "green" : "orange",
  });
});
