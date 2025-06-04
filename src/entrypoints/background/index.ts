import { onMessage } from "webext-bridge/background";
import { logger } from "@/lib/logger";
import Recorder from "@/lib/bucket/Recorder.class";

export default defineBackground({
  persistent: true,
  main: () => {
    logger("Background script loaded");
    const recorder = new Recorder();
    recorder.startRecording();

    onMessage("setToRecord", ({ data }) => {
      data ? recorder.startRecording() : recorder.stopRecording();
    });

    onMessage("settings:tabOnly", ({ data }) => {
      recorder.setTabs(data as string[]);
    });
  },
});
