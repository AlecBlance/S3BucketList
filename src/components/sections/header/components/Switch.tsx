import { Switch } from "@/components/ui/switch";
import { logger } from "@/lib/logger";
import { sendMessage } from "webext-bridge/popup";
import { stopRecordingBadge } from "@/lib/bucket/badge";
import useRecording from "@/lib/store/useRecording.store";

const CustomSwitch = () => {
  const { recording, setRecording, recordingLoading } = useRecording(
    (state) => state,
  );

  const setToRecord = async (data: boolean) => {
    try {
      await sendMessage("setToRecord", data, "background");
      logger("Switch toggled:", data);
    } catch (error) {
      logger("Error setting recording state:", error);
    }
  };

  if (recordingLoading) {
    return null;
  }

  return (
    <Switch
      id="airplane-mode"
      checked={recording}
      onCheckedChange={() => {
        setRecording(!recording);
        setToRecord(!recording);
        if (!recording === false) {
          stopRecordingBadge();
        } else {
          (browser.action ?? browser.browserAction).setBadgeText({ text: "" });
        }
      }}
    />
  );
};

export default CustomSwitch;
