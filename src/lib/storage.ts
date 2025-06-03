import { IBucket, ISettings } from "@/@types";

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
