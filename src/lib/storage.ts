import { IBucket, ISettings, ICheckJob } from "@/@types";

export interface TabDiscovery {
  hostname: string;
  recordId?: string;
  site?: string;
  unread: boolean;
}

export const tabDiscoveriesStorage = storage.defineItem<
  Record<string, TabDiscovery[]>
>("session:tabDiscoveries", { fallback: {} });

export const workspaceIntroStorage = storage.defineItem<boolean>(
  "local:workspaceIntroSeen",
  { fallback: false },
);

export const jobsStorage = storage.defineItem<ICheckJob[]>("local:checkJobs", {
  fallback: [],
});

export const bucketsStorage = storage.defineItem<IBucket[]>("local:buckets", {
  fallback: [],
});

export const isRecordingStorage = storage.defineItem<boolean>(
  "local:isRecording",
  {
    fallback: true,
  },
);

export const lastSeenStorage = storage.defineItem<number>("local:lastSeen", {
  fallback: 0,
});

export const settingsStorage = storage.defineItem<ISettings>("local:settings", {
  fallback: {
    tabOnly: {
      enabled: false,
      tabIds: [],
    },
  },
});
