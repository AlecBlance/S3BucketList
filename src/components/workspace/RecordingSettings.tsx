import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Settings } from "lucide-react";
import { settingsStorage } from "@/lib/storage";
import { sendCommand } from "@/lib/workspace-client";

export default function RecordingSettings() {
  const [open, setOpen] = useState(false);
  const [tabs, setTabs] = useState<{ id: string; title: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setMessage("");
    setLoaded(false);
    setBusy(true);
    void Promise.all([browser.tabs.query({}), settingsStorage.getValue()])
      .then(([tabs, settings]) => {
        if (!live) return;
        setTabs(
          tabs
            .filter(
              (tab) =>
                tab.id !== undefined && /^https?:\/\//.test(tab.url ?? ""),
            )
            .map((tab) => ({
              id: String(tab.id),
              title: tab.title || new URL(tab.url!).hostname,
            })),
        );
        setSelected(settings.tabOnly.enabled ? settings.tabOnly.tabIds : []);
        setLoaded(true);
      })
      .catch(() => {
        if (live)
          setMessage("Could not load recording tabs. Close and try again.");
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [open]);
  const save = async () => {
    setBusy(true);
    try {
      await sendCommand({ type: "scope:set", tabIds: selected });
      setOpen(false);
    } catch {
      setMessage("Could not save recording scope. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="icon-button"
          aria-label="Recording settings"
          title="Recording settings"
        >
          <Settings size={17} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content className="review-modal">
          <Dialog.Title>Recording settings</Dialog.Title>
          <Dialog.Description>
            Record all tabs, or select the tabs you want to watch. Existing
            discoveries are kept when you change scope.
          </Dialog.Description>
          <p className="help-text">
            {selected.length
              ? `${selected.length} selected tabs only`
              : "All tabs are recorded"}
          </p>
          <div className="scope-tabs">
            {tabs.map((tab) => (
              <label className="check-label" key={tab.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(tab.id)}
                  onChange={(event) =>
                    setSelected((previous) =>
                      event.target.checked
                        ? [...previous, tab.id]
                        : previous.filter((id) => id !== tab.id),
                    )
                  }
                />
                <span>{tab.title}</span>
              </label>
            ))}
          </div>
          <p role="status" className="help-text">
            {message}
          </p>
          <div className="button-row">
            <button
              className="button"
              disabled={!loaded}
              onClick={() => setSelected([])}
            >
              Choose all tabs
            </button>
            <Dialog.Close className="button">Cancel</Dialog.Close>
            <button
              className="button primary"
              disabled={busy || !loaded}
              onClick={() => void save()}
            >
              Save scope
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
