import { useEffect, useState } from "react";
import WorkspaceView, {
  WorkspaceActions,
} from "@/components/workspace/WorkspaceView";
import { useWorkspaceData } from "@/lib/hooks/useWorkspaceData";
import { sendCommand } from "@/lib/workspace-client";
import RecordingSettings from "@/components/workspace/RecordingSettings";
import PageExtractor from "@/components/workspace/PageExtractor";
import AddBuckets from "@/components/workspace/AddBuckets";
import WorkspaceGuide from "@/components/workspace/WorkspaceGuide";

const readSelection = () => {
  try {
    return decodeURIComponent(location.hash.slice(1)) || undefined;
  } catch {
    return undefined;
  }
};
export default function App() {
  const data = useWorkspaceData();
  const [selected, setSelected] = useState(readSelection);
  useEffect(() => {
    const update = () => setSelected(readSelection());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const actions: WorkspaceActions = {
    select(hostname) {
      location.hash = hostname ? encodeURIComponent(hostname) : "";
      setSelected(hostname);
    },
    queue: (hostnames) => sendCommand({ type: "buckets:queue", hostnames }),
    cancel: (id) => sendCommand({ type: "jobs:cancel", id }),
    async remove(hostname) {
      await sendCommand({ type: "buckets:remove", hostnames: [hostname] });
      location.hash = "";
      setSelected(undefined);
    },
    async removeMany(hostnames) {
      await sendCommand({ type: "buckets:remove", hostnames });
      if (selected && hostnames.includes(selected)) {
        location.hash = "";
        setSelected(undefined);
      }
    },
    save: (hostname, notes, reviewStatus) =>
      sendCommand({ type: "buckets:annotate", hostname, notes, reviewStatus }),
    recording: (enabled) => sendCommand({ type: "recording:set", enabled }),
    review: (hostname, status) =>
      sendCommand({ type: "buckets:review", hostname, status }),
    verifyObject: (hostname, url, content) =>
      sendCommand({ type: "buckets:verify-object", hostname, url, content }),
    browseObjects: (hostname, prefix) =>
      sendCommand({ type: "buckets:browse", hostname, prefix }),
  };
  return (
    <WorkspaceView
      {...data}
      selected={selected}
      actions={actions}
      settings={<RecordingSettings />}
      tools={
        <>
          <PageExtractor />
          <WorkspaceGuide />
        </>
      }
      addTargets={(onViewAll) => <AddBuckets onViewAll={onViewAll} />}
      initialView={
        new URLSearchParams(location.search).get("view") === "all"
          ? "all"
          : "review"
      }
      onViewChange={(view) => {
        const url = new URL(location.href);
        if (view === "all") url.searchParams.set("view", "all");
        else url.searchParams.delete("view");
        history.replaceState(null, "", url);
      }}
    />
  );
}
