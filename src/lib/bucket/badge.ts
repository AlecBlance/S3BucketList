export const setTabBadge = async (
  tabId: number,
  count: number,
): Promise<void> => {
  const action = browser.action ?? browser.browserAction;
  await action.setBadgeBackgroundColor({ tabId, color: "green" });
  await action.setBadgeText({
    tabId,
    text: count > 99 ? "99+" : count ? String(count) : "",
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
