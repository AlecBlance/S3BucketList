import type { IBucket } from "@/@types";

export type WorkspaceCommand =
  | { type: "buckets:add"; inputs: string[] }
  | {
      type: "buckets:verify-object";
      hostname: string;
      url: string;
      content?: boolean;
    }
  | { type: "buckets:browse"; hostname: string; prefix: string }
  | { type: "buckets:review"; hostname: string; status: "expected" | "todo" }
  | { type: "scope:set"; tabIds: string[] }
  | { type: "buckets:queue"; hostnames: string[] }
  | { type: "jobs:cancel"; id: string }
  | { type: "buckets:remove"; hostnames: string[] }
  | {
      type: "buckets:annotate";
      hostname: string;
      notes: string;
      reviewStatus: NonNullable<IBucket["reviewStatus"]>;
    }
  | { type: "recording:set"; enabled: boolean }
  | { type: "page:extract"; tabId: number };

export async function sendCommand<T = unknown>(
  command: WorkspaceCommand,
): Promise<T> {
  let response;
  try {
    response = await browser.runtime.sendMessage({ workspace: 1, command });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /Receiving end does not exist|Could not establish connection|Extension context invalidated|message port closed|message channel closed/i.test(
        message,
      )
    ) {
      throw new Error(
        "The extension page is no longer connected to its background worker. Close this workspace, reload S3BucketList in your browser's Extensions page, then open it again from the toolbar. Your saved discoveries will be kept.",
      );
    }
    throw new Error(
      "Could not send the action to the extension background worker. Reopen the extension and try again.",
    );
  }
  if (!response?.ok)
    throw new Error(
      response?.error ?? "The background worker is unavailable. Try again.",
    );
  return response.value as T;
}

export async function openWorkspace(
  hostname?: string,
  view: "review" | "all" = "review",
) {
  const base = browser.runtime.getURL("/workspace.html");
  const target = view === "all" ? `${base}?view=all` : base;
  const url = hostname ? `${target}#${encodeURIComponent(hostname)}` : target;
  const existing = (await browser.tabs.query({})).find(
    (tab) => tab.url?.split(/[?#]/)[0] === base,
  );
  if (existing?.id !== undefined) {
    await browser.tabs.update(existing.id, { active: true, url });
    await browser.windows.update(existing.windowId, { focused: true });
  } else await browser.tabs.create({ url });
}
