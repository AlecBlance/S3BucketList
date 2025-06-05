import { IBucket } from "@/@types";
import { lastSeenStorage } from "../storage";

/**
 * Add badge number
 */

export const addBadgeNumber = async (buckets: IBucket[]): Promise<void> => {
  console.log("Adding badge number", buckets);
  const lastSeen = await lastSeenStorage.getValue();
  const unseenPublicBuckets = buckets.filter(
    (bucket) => bucket.public && bucket.date > lastSeen,
  ).length;
  if (!unseenPublicBuckets) return;
  (browser.action ?? browser.browserAction).setBadgeText({
    text: unseenPublicBuckets.toString(),
  });
  (browser.action ?? browser.browserAction).setBadgeBackgroundColor({
    color: "green",
  });
};

/**
 * Stop recording - badge (!)
 */
export const stopRecordingBadge = async (): Promise<void> => {
  (browser.action ?? browser.browserAction).setBadgeText({
    text: "!",
  });
  (browser.action ?? browser.browserAction).setBadgeBackgroundColor({
    color: "orange",
  });
};
