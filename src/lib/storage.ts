import { IBucket } from "@/@types";

export const bucketsStorage = storage.defineItem<IBucket[]>("local:buckets", {
  fallback: [],
});

export const isRecordingStorage = storage.defineItem<boolean>(
  "local:isRecording",
  {
    fallback: true,
  },
);
