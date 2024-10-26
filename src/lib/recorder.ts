import * as cheerio from "cheerio";
import { addNumber } from "@/utils/helper.utils";
import { IBucketType } from "@/types";

const storage = chrome.storage.local;
const preRecord = new Set();

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
    } else if (hasListBucket.length) {
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
    console.log("Error in getPerms", e);
  }
  return { type, info: { permissions, date, hostname } };
};

/**
 * Gets the bucket info from the offscreen page
 *
 * @param hostname the hostname of the bucket
 */
const getBucketInfo = async (hostname: string) => {
  try {
    // Combining results to have a single text to search
    const text = await Promise.all([
      fetch("http://" + hostname + "/?acl").then((res) => res.text()),
      fetch("http://" + hostname + "/").then((res) => res.text()),
    ]).then(([aclText, listBucketText]) => aclText + listBucketText);
    return getPerms(cheerio.load(text), hostname);
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
export const recordBuckets = async (
  response: chrome.webRequest.WebResponseHeadersDetails,
) => {
  const s3 = response.responseHeaders?.some(
    (header) => header.name == "x-amz-request-id",
  );
  if (!s3 || response.frameId < 0) return;
  const { hostname, pathname } = new URL(response.url);
  // There are instances that the bucket name is a path
  const bucketHostname =
    hostname === "s3.amazonaws.com"
      ? `${hostname}/${pathname.split("/")[1]}`
      : hostname;
  const hasFavicon = bucketHostname.includes("favicon.ico");
  if (hasFavicon) return;
  if (!preRecord.add(bucketHostname)) return;
  const { buckets }: { buckets: IBucketType } = await storage.get("buckets");
  const isPresent = Object.values(buckets)
    .flat()
    .some((bucket) => bucket.hostname === bucketHostname);
  // Double requests that might be recorded that has favicon.ico
  if (isPresent) return;
  const bucketInfo = await getBucketInfo(bucketHostname);
  if (!bucketInfo) return;
  storage.set({
    buckets: {
      ...buckets,
      [bucketInfo.type]: [
        { ...bucketInfo.info, origin: response.initiator },
        ...buckets[bucketInfo.type],
      ],
    },
  });
  if (bucketInfo.type === "good") addNumber(buckets);
};
