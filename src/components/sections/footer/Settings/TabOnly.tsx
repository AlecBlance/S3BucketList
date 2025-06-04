import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MultiSelect } from "@/components/ui/multiselect";
import { settingsStorage } from "@/lib/storage";
import useSettings from "@/lib/store/useSettings.store";
import { sendMessage } from "webext-bridge/popup";

const TabOnly = () => {
  const { settings } = useSettings((state) => state);
  const [isEnabled, setIsEnabled] = useState(
    settings.tabOnly?.enabled || false,
  );

  // Fetch all tabs and filter out those without an ID
  const { data: tabs = [] } = useQuery({
    queryKey: ["tabOnlyEnabled", isEnabled],
    enabled: isEnabled,
    queryFn: async () => {
      let tabs = await browser.tabs.query({});
      tabs = tabs.filter((tab) => tab.id !== undefined);
      return tabs.map((tab, index) => ({
        value: String(tab.id),
        label: `[Tab ${index + 1}] ${tab.title || "Untitled Tab"}`,
      }));
    },
  });

  return (
    <div className="mt-2 flex gap-3">
      <Checkbox
        id="tab-only"
        checked={isEnabled}
        onCheckedChange={() => {
          setIsEnabled(!isEnabled);
          // Send message to background to toggle tab-only recording
          !isEnabled && sendMessage("settings:tabOnly", [], "background");
          // Update settings storage
          settingsStorage.setValue({
            ...settings,
            tabOnly: {
              enabled: !isEnabled,
              tabIds: !isEnabled === true ? settings.tabOnly?.tabIds || [] : [],
            },
          });
        }}
      />
      <div className="flex w-full flex-col gap-2">
        <Label htmlFor="tab-only" className="text-primary-foreground">
          Tab-only recording
        </Label>
        {isEnabled && (
          <MultiSelect
            options={tabs}
            onValueChange={(tabIds) => {
              // Send message to background to update tab IDs for recording
              sendMessage("settings:tabOnly", tabIds, "background");
              // Update settings storage with selected tab IDs
              settingsStorage.setValue({
                ...settings,
                tabOnly: {
                  enabled: isEnabled,
                  tabIds,
                },
              });
            }}
            defaultValue={settings.tabOnly?.tabIds || []}
            placeholder="Select tabs to record"
            maxCount={3}
            modalPopover={true}
          />
        )}
      </div>
    </div>
  );
};

export default TabOnly;
