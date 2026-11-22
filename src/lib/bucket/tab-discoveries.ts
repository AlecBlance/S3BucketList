import type { IBucket } from "@/@types";
import { tabDiscoveriesStorage, type TabDiscovery } from "@/lib/storage";
import { safeOrigin } from "./observations";
import { setTabBadge } from "./badge";

const LIMIT = 100;
let chain: Promise<void> = Promise.resolve();

function updateTab(
  tabId: number,
  update: (items: TabDiscovery[]) => TabDiscovery[],
) {
  if (!Number.isInteger(tabId) || tabId < 0) return Promise.resolve();
  const task = chain.then(async () => {
    const tabs = await tabDiscoveriesStorage.getValue();
    const items = update(tabs[tabId] ?? []);
    if (items.length) tabs[tabId] = items;
    else delete tabs[tabId];
    await tabDiscoveriesStorage.setValue(tabs);
    await setTabBadge(tabId, items.filter((item) => item.unread).length).catch(
      () => undefined,
    );
  });
  chain = task.catch(() => undefined);
  return task;
}

export const recordTabDiscovery = (
  tabId: number,
  bucket: IBucket,
  initiator?: string,
) =>
  updateTab(tabId, (items) => {
    const match = (item: TabDiscovery) =>
      item.hostname === bucket.hostname && item.recordId === bucket.recordId;
    const previous = items.find(match);
    return [
      {
        hostname: bucket.hostname,
        recordId: bucket.recordId,
        site: safeOrigin(initiator) ?? previous?.site,
        unread: previous?.unread ?? true,
      },
      ...items.filter((item) => !match(item)),
    ].slice(0, LIMIT);
  });

export const acknowledgeTabDiscoveries = (tabId: number) =>
  updateTab(tabId, (items) =>
    items.map((item) => ({ ...item, unread: false })),
  );

export const forgetTabDiscoveries = (tabId: number) =>
  updateTab(tabId, () => []);

export function recentTabRows(items: TabDiscovery[], buckets: IBucket[]) {
  const byHostname = new Map(
    buckets.map((bucket) => [bucket.hostname, bucket]),
  );
  return items
    .flatMap((item) => {
      const bucket = byHostname.get(item.hostname);
      return bucket && bucket.recordId === item.recordId
        ? [{ bucket, site: item.site }]
        : [];
    })
    .slice(0, 20);
}
