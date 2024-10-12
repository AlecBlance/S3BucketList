import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { memo } from "react";

const CustomSwitch = () => {
  const [checked, setChecked] = useState(true);
  const [isDoneChecking, setIsDoneChecking] = useState(false);

  const handleCheck = async (isChecked: boolean) => {
    chrome.storage.local.set({ record: isChecked });
    chrome.runtime.sendMessage(isChecked);
    setChecked(isChecked);
  };

  const checkRecord = async () => {
    const { record } = (await chrome.storage.local.get("record")) as {
      record: boolean;
    };
    if (record) {
      chrome.action.setBadgeText({
        text: "",
      });
    }
    setChecked(record);
    setIsDoneChecking(true);
  };

  useEffect(() => {
    checkRecord();
  }, []);

  return (
    isDoneChecking && <Switch checked={checked} onCheckedChange={handleCheck} />
  );
};
export default memo(CustomSwitch);
