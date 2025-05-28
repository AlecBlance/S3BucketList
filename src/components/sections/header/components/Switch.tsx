import { Switch } from "@/components/ui/switch";
import { logger } from "@/lib/logger";
import { useState } from "react";
const CustomSwitch = () => {
  const [checked, setChecked] = useState<boolean>(false);

  return (
    <Switch
      id="airplane-mode"
      checked={checked}
      onCheckedChange={() => {
        setChecked(!checked);
        logger("Switch toggled:", !checked);
      }}
    />
  );
};

export default CustomSwitch;
