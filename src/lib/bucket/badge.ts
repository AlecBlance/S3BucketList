import { IBucket } from "@/@types";
import { needsReview } from "./triage";

/**
 * Add badge number
 */

export const addBadgeNumber = async (buckets: IBucket[]): Promise<void> => {
  const count = buckets.filter(needsReview).length;
  await (browser.action ?? browser.browserAction).setBadgeText({
    text: count ? count.toString() : "",
  });
  await (browser.action ?? browser.browserAction).setBadgeBackgroundColor({
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
