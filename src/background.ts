import * as cheerio from "cheerio";
import { IBucketInfo } from "./types";

const requests = chrome.webRequest.onHeadersReceived;
const storage = chrome.storage.local;

/**
 * Gets the buckets stored in the session storage
 */
const getBuckets = async () => {
  const { buckets } = await storage.get("buckets");
  return buckets as IBucketInfo[];
};

/**
 * Changes the badge text to the number of buckets
 *
 * @param buckets list of buckets from the storage
 */
const addNumber = async (buckets: IBucketInfo[]) => {
  const { lastSeen } = await storage.get("lastSeen");
  const bucketsListed =
    buckets.filter(
      (bucket) => bucket.type === "good" && bucket.date > lastSeen.good,
    ).length + 1;
  chrome.action.setBadgeText({
    text: bucketsListed.toString(),
  });
  chrome.action.setBadgeBackgroundColor({
    color: "green",
  });
};

/**
 * Gets the permissions from the offscreen page
 *
 * @param $ the cheerio object
 */
const getPerms = ($: cheerio.CheerioAPI, hostname: string): IBucketInfo => {
  const permissions = {} as Record<string, string[]>;
  const hasUri = $("URI");
  const hasCode = $("Code");
  let type = "";
  const date = new Date().getTime();
  try {
    if (!hasUri.length && !hasCode.length) throw new Error("No permissions");
    if (hasUri.length) {
      hasUri.toArray().map((elem) => {
        const title = $(elem).text().split("/").pop()!;
        const perm = $(elem).parent().next().text();
        permissions[title] = [...(permissions[title] || []), perm];
      });
      type = "good";
    } else {
      const elem = hasCode[0];
      const title = $(elem).text();
      const perm = $(elem).next().text();
      type = "bad";
      permissions[title] = [...(permissions[title] || []), perm];
    }
  } catch (e) {
    type = "error";
    console.log(e);
  }
  return { type, permissions, date, hostname };
};

/**
 * Gets the bucket info from the offscreen page
 *
 * @param hostname the hostname of the bucket
 */
const getBucketInfo = async (hostname: string, buckets: IBucketInfo[]) => {
  try {
    const response = await fetch("http://" + hostname + "/?acl");
    const text = await response.text();
    const permissions = getPerms(cheerio.load(text), hostname);
    storage.set({ buckets: [permissions, ...buckets] });
    return permissions;
  } catch (e) {
    console.log(e);
    return false;
  }
};

/**
 * Records the buckets from the network requests
 *
 * @param response the response from the network request
 */
const recordBuckets = (
  response: chrome.webRequest.WebResponseHeadersDetails,
): void => {
  const s3 = response.responseHeaders?.some(
    (header) => header.name == "x-amz-request-id",
  );
  if (!s3) return;
  getBuckets().then((buckets) => {
    let { hostname, pathname } = new URL(response.url);
    if (hostname === "s3.amazonaws.com") {
      hostname += "/" + pathname.split("/")[1];
    }
    const isPresent = buckets.some(
      (bucket: IBucketInfo) => bucket.hostname === hostname,
    );
    const noFavicon = !hostname.includes("favicon.ico");
    if (!isPresent && noFavicon) {
      getBucketInfo(hostname, buckets).then((permissions) => {
        permissions && permissions.type === "good" && addNumber(buckets);
      });
    }
  });
};

/**
 * Listens for the network requests
 */
const listener = async () => {
  requests.addListener(
    recordBuckets,
    {
      urls: ["<all_urls>"],
    },
    ["responseHeaders"],
  );
};

/**
 * Handles messages from the popup
 *
 * @param toRecord whether to record the buckets
 * @param _sender the sender of the message
 * @param sendResponse the response to send back
 */
const fromPopup = (
  toRecord: boolean,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: any) => void,
) => {
  if (toRecord) {
    listener();
    chrome.action.setBadgeText({
      text: "",
    });
  } else {
    requests.removeListener(recordBuckets);
    chrome.action.setBadgeText({
      text: "!",
    });
    chrome.action.setBadgeBackgroundColor({
      color: "orange",
    });
  }
};

listener();
storage.set({
  buckets: [],
  record: true,
  lastSeen: { good: 0, bad: 0, error: 0 },
});
chrome.runtime.onMessage.addListener(fromPopup);
