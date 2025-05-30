import { Switch } from "@/components/ui/switch";
import { logger } from "@/lib/logger";
import { useState } from "react";
import { sendMessage } from "webext-bridge/popup";
import { isRecordingStorage } from "@/lib/storage";
import { useQuery } from "@tanstack/react-query";

const CustomSwitch = () => {
  const { data: isRecording, isLoading } = useQuery({
    queryKey: ["isRecording"],
    queryFn: () => isRecordingStorage.getValue(),
  });

  const [isRecordingState, setIsRecordingState] = useState(isRecording);

  const setToRecord = async (data: boolean) => {
    try {
      await sendMessage("setToRecord", data, "background");
      await isRecordingStorage.setValue(data);
      logger("Switch toggled:", data);
    } catch (error) {
      logger("Error setting recording state:", error);
    }
  };

  useEffect(() => {
    setIsRecordingState(isRecording);
  }, [isRecording]);

  if (isLoading) {
    return null;
  }

  return (
    <Switch
      id="airplane-mode"
      checked={isRecordingState}
      onCheckedChange={() => {
        setIsRecordingState(!isRecordingState);
        setToRecord(!isRecordingState);
      }}
    />
  );
};

export default CustomSwitch;
