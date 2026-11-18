import { onMessage } from "webext-bridge/background";
import { logger } from "@/lib/logger";
import Recorder from "@/lib/bucket/Recorder.class";

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
  },
});
