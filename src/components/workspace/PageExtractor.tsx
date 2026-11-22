import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { sendCommand } from "@/lib/workspace-client";

/** Optional lead collection, deliberately kept outside the attention list. */
export default function PageExtractor() {
  const [open, setOpen] = useState(false);
  const [tabs, setTabs] = useState<{ id: number; title: string }[]>([]);
  const [tabId, setTabId] = useState<number>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const show = async () => {
    setOpen(true);
    setBusy(true);
    setMessage("");
    setTabId(undefined);
    setTabs([]);
    try {
      const candidates = (await browser.tabs.query({})).filter(
        (tab) => tab.id !== undefined && /^https?:\/\//.test(tab.url ?? ""),
      );
      setTabs(
        candidates.map((tab) => ({
          id: tab.id!,
          title: tab.title || new URL(tab.url!).hostname,
        })),
      );
    } catch {
      setMessage("Could not load web tabs. Close and try again.");
    } finally {
      setBusy(false);
    }
  };
  const extract = async () => {
    if (tabId === undefined) return;
    setBusy(true);
    try {
      const workspace = await browser.tabs.getCurrent();
      await browser.tabs.update(tabId, { active: true });
      try {
        const result = await sendCommand<{ found: number }>({
          type: "page:extract",
          tabId,
        });
        setMessage(
          `${result.found} page references saved in All discoveries. Extraction sent no target requests.`,
        );
      } finally {
        if (workspace?.id !== undefined)
          await browser.tabs.update(workspace.id, { active: true });
      }
    } catch {
      setMessage(
        "Could not read that page. Choose a normal web page and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="button" onClick={() => void show()}>
          Extract page references…
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content className="review-modal">
          <Dialog.Title>Extract page references</Dialog.Title>
          <Dialog.Description>
            Choose an open web tab. It will briefly become active while its
            links and inline configuration are read. This collects leads without
            fetching targets.
          </Dialog.Description>
          <label className="field-label" htmlFor="extract-tab">
            Web page
          </label>
          <select
            id="extract-tab"
            className="field"
            value={tabId ?? ""}
            onChange={(event) =>
              setTabId(
                event.target.value ? Number(event.target.value) : undefined,
              )
            }
          >
            <option value="">Choose a page…</option>
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.title}
              </option>
            ))}
          </select>
          <p className="help-text" role="status">
            {message}
          </p>
          <div className="button-row">
            <Dialog.Close className="button">Close</Dialog.Close>
            <button
              className="button primary"
              disabled={busy || tabId === undefined}
              onClick={() => void extract()}
            >
              {busy ? "Reading…" : "Extract references"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
