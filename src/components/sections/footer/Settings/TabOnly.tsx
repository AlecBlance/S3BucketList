import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MultiSelect } from "@/components/ui/multiselect";
import { settingsStorage } from "@/lib/storage";

const TabOnly = () => {
  const [isEnabled, setIsEnabled] = useState(false);

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

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    enabled: isEnabled,
    queryFn: async () => await settingsStorage.getValue(),
  });

  return (
    <div className="mt-2 flex gap-3">
      <Checkbox
        id="tab-only"
        onCheckedChange={() => setIsEnabled(!isEnabled)}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="tab-only" className="text-primary-foreground">
          Tab-only recording
        </Label>
        {isEnabled && (
          <MultiSelect
            options={tabs}
            onValueChange={(tabIds) => {
              settingsStorage.setValue({
                ...settings,
                tabOnly: {
                  enabled: isEnabled,
                  tabIds,
                },
              });
            }}
            placeholder="Select tabs to record"
            maxCount={3}
          />
        )}
      </div>
    </div>
  );
};

export default TabOnly;
