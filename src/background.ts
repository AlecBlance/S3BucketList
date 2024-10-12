import * as cheerio from "cheerio";
import { IBucketType } from "./types";
import { getStorageKeyValue } from "@/utils/helper.utils";

const requests = chrome.webRequest.onHeadersReceived;
const storage = chrome.storage.local;

/**
 * Gets the buckets stored in the session storage
 */
const getBuckets = async () => {
  const { buckets } = await storage.get("buckets");
  return buckets as IBucketType;
};

/**
 * Changes the badge text to the number of buckets
 *
 * @param buckets list of buckets from the storage
 */
const addNumber = async (buckets: IBucketType) => {
  const { lastSeen } = await storage.get("lastSeen");
  const bucketsListed =
    buckets.good.filter((bucket) => bucket.date > lastSeen.good).length + 1;
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
const getPerms = ($: cheerio.CheerioAPI, hostname: string) => {
  const permissions = {} as Record<string, string[]>;
  const hasUri = $("URI");
  const hasCode = $("Code");
  const hasListBucket = $("ListBucketResult");
  let type = "";
  const date = new Date().getTime();
  try {
    if (!hasUri.length && !hasCode.length && hasListBucket)
      throw new Error("No permissions");
    if (hasUri.length) {
      hasUri.toArray().map((elem) => {
        const title = $(elem).text().split("/").pop()!;
        const perm = $(elem).parent().next().text();
        permissions[title] = [...(permissions[title] || []), perm];
      });
      type = "good";
    }
    if (hasListBucket.length) {
      permissions["ListBucket"] = ["True"];
      type = "good";
    } else if (hasCode.length) {
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
  return { type, info: { permissions, date, hostname } };
};

/**
 * Gets the bucket info from the offscreen page
 *
 * @param hostname the hostname of the bucket
 */
const getBucketInfo = async (hostname: string, buckets: IBucketType) => {
  try {
    const text = await Promise.all([
      fetch("http://" + hostname + "/?acl").then((res) => res.text()),
      fetch("http://" + hostname + "/").then((res) => res.text()),
    ]).then(([aclText, listBucketText]) => aclText + listBucketText);
    const permissions = getPerms(cheerio.load(text), hostname);
    storage.set({
      buckets: {
        ...buckets,
        [permissions.type]: [permissions.info, ...buckets[permissions.type]],
      },
    });
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
    const url = new URL(response.url);
    let hostname = url.hostname;
    const pathname = url.pathname;
    if (hostname === "s3.amazonaws.com") {
      hostname += "/" + pathname.split("/")[1];
    }
    const isPresent = Object.values(buckets)
      .flat()
      .some((bucket) => bucket.hostname === hostname);
    const noFavicon = !hostname.includes("favicon.ico");
    if (!isPresent && noFavicon) {
      getBucketInfo(hostname, buckets).then((permissions) => {
        if (permissions && permissions.type === "good") addNumber(buckets);
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
const fromPopup = (toRecord: boolean) => {
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

getStorageKeyValue("buckets").then((response: Record<string, any>) => {
  if (Object.keys(response).length && Object.keys(response.buckets).length)
    return;
  storage.set({
    buckets: { good: [], bad: [], error: [] },
    record: true,
    lastSeen: { good: 0, bad: 0, error: 0 },
  });
});

chrome.runtime.onMessage.addListener(fromPopup);
