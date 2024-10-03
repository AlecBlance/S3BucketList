import * as cheerio from "cheerio";
import { IBucketInfo } from "./types";

const requests = chrome.webRequest.onHeadersReceived;
const storage = chrome.storage.session;
let status = true;

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
  const bucketsListed =
    buckets.filter((bucket) => bucket.type === "good").length + 1;
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
    let title = "";
    let perm = "";
    if (hasUri.length) {
      hasUri.toArray().map((elem) => {
        title = $(elem).text().split("/").pop()!;
        perm = $(elem).parent().next().text();
      });
      type = "good";
    } else {
      const elem = hasCode[0];
      title = $(elem).text();
      perm = $(elem).next().text();
      type = "bad";
    }
    permissions[title] = [...(permissions[title] || []), perm];
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
    storage.set({ buckets: [...buckets, permissions] });
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
  sendResponse: (response?: any) => void,
) => {
  if (!toRecord)
    return sendResponse({
      record: status,
    });
  if (requests.hasListener(recordBuckets)) {
    requests.removeListener(recordBuckets);
    status = false;
    chrome.action.setBadgeText({
      text: "!",
    });
    chrome.action.setBadgeBackgroundColor({
      color: "orange",
    });
  } else {
    listener();
    status = true;
    chrome.action.setBadgeText({
      text: "",
    });
  }
};

listener();
storage.set({ buckets: [] });
chrome.runtime.onMessage.addListener(fromPopup);
