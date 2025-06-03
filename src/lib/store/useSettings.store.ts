import { ISettings } from "@/@types";
import { create } from "zustand";

interface IUseSettings {
  settings: ISettings;
  setSettings: (query: ISettings) => void;
}

const useSettings = create<IUseSettings>((set) => ({
  settings: {
    tabOnly: {
      enabled: false,
      tabIds: [],
    },
  },
  setSettings: (settings: ISettings) => set({ settings }),
}));

export default useSettings;
