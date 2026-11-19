import { onMessage } from "webext-bridge/background";
import { logger } from "@/lib/logger";
import Recorder from "@/lib/bucket/Recorder.class";
import { removeFromBucketStorage } from "@/lib/bucket/recorder";

export default defineBackground({
  persistent: true,
  main: () => {
    logger("Background script loaded");
    const recorder = new Recorder();

    onMessage("setToRecord", ({ data }) => {
      return data ? recorder.startRecording() : recorder.stopRecording();
    });

    onMessage("settings:tabOnly", ({ data }) => {
      return recorder.setTabs(data as string[]);
    });

    onMessage("buckets:remove", ({ data }) => {
      if (
        !Array.isArray(data) ||
        !data.every((value) => typeof value === "string")
      ) {
        throw new Error("Expected an array of bucket hostnames");
      }
      return removeFromBucketStorage(data);
    });
  },
});
