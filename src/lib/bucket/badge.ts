import { IBucket } from "@/@types";
import { lastSeenStorage } from "../storage";

/**
 * Add badge number
 */

export const addBadgeNumber = async (buckets: IBucket[]): Promise<void> => {
  const lastSeen = await lastSeenStorage.getValue();
  const unseenPublicBuckets = buckets.filter(
    (bucket) => bucket.public && bucket.date > lastSeen,
  ).length;
  browser.action.setBadgeText({
    text: unseenPublicBuckets.toString(),
  });
  browser.action.setBadgeBackgroundColor({
    color: "green",
  });
};

/**
 * Stop recording - badge (!)
 */
export const stopRecordingBadge = async (): Promise<void> => {
  browser.action.setBadgeText({
    text: "!",
  });
  browser.action.setBadgeBackgroundColor({
    color: "orange",
  });
};
