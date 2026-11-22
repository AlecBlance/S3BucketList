import { useEffect, useState } from "react";
import { ArrowUpRight, Pause, Play, Check } from "lucide-react";
import type { IBucket } from "@/@types";
import Brand from "@/components/workspace/Brand";
import StatusLabel from "@/components/workspace/StatusLabel";
import { useWorkspaceData } from "@/lib/hooks/useWorkspaceData";
import { openWorkspace, sendCommand } from "@/lib/workspace-client";
import { reviewReason, reviewHelpKey } from "@/lib/bucket/triage";
import { recentTabRows } from "@/lib/bucket/tab-discoveries";
import { tabDiscoveriesStorage, type TabDiscovery } from "@/lib/storage";
import { subscribeStorage } from "@/lib/subscribeStorage";
import "@/components/workspace/workspace.css";

export function PopupView({
  buckets,
  recording,
  open,
  toggle,
  message = "",
  discoveries,
  loading = false,
}: {
  buckets: IBucket[];
  recording: boolean;
  open(hostname?: string, view?: "review" | "all"): void;
  toggle(): void;
  message?: string;
  discoveries: TabDiscovery[];
  loading?: boolean;
}) {
  const rows = recentTabRows(discoveries, buckets);
  return (
    <div className="compact-popup focused-popup">
      <header className="popup-header">
        <Brand />
        <button
          className="icon-button"
          aria-label={recording ? "Pause recording" : "Resume recording"}
          title={recording ? "Pause recording" : "Resume recording"}
          onClick={toggle}
        >
          {recording ? <Pause size={17} /> : <Play size={17} />}
        </button>
      </header>
      <div className="popup-review-heading">
        <h1>This tab</h1>
        <p>Recent S3 discoveries. Saved history is in the dashboard.</p>
      </div>
      <div className="popup-list">
        {rows.map(({ bucket, site }) => (
          <div className="popup-bucket-item" key={bucket.hostname}>
            <button
              className="popup-bucket-row"
              aria-label={`View ${bucket.endpoint?.bucket ?? bucket.hostname}`}
              aria-describedby={`popup-reason-${encodeURIComponent(bucket.hostname)}`}
              onClick={() => open(bucket.hostname, "all")}
            >
              <div>
                <strong title={bucket.endpoint?.bucket ?? bucket.hostname}>
                  {bucket.endpoint?.bucket ?? bucket.hostname}
                </strong>
                {site && <span className="row-site">{site}</span>}
              </div>
              <ArrowUpRight size={16} />
            </button>
            <div
              className="popup-statuses"
              id={`popup-reason-${encodeURIComponent(bucket.hostname)}`}
            >
              <StatusLabel
                label={reviewReason(bucket)}
                helpKey={reviewHelpKey(bucket)}
              />
            </div>
          </div>
        ))}
        {!rows.length && (
          <div className="empty-state small">
            <Check size={28} />
            <h3>
              {loading ? "Loading this tab…" : "No discoveries in this tab"}
            </h3>
            <p>
              {!loading &&
                (recording
                  ? "Browse a site that uses S3, or open the dashboard to see saved discoveries."
                  : "Recording is paused. Resume it to find new buckets.")}
            </p>
          </div>
        )}
      </div>
      {message && (
        <p className="popup-message" role="status">
          {message}
        </p>
      )}
      <footer className="popup-footer">
        <button className="button" onClick={() => open(undefined, "all")}>
          View all discoveries <ArrowUpRight size={15} />
        </button>
        <span className="quiet">
          <span className={`recording-dot ${recording ? "on" : ""}`} />
          {recording ? "Recording" : "Paused"}
        </span>
      </footer>
    </div>
  );
}

export default function App() {
  const { buckets, recording } = useWorkspaceData();
  const [message, setMessage] = useState("");
  const [tabId, setTabId] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [tabs, setTabs] = useState<Record<string, TabDiscovery[]>>({});
  useEffect(() => subscribeStorage(tabDiscoveriesStorage, setTabs), []);
  useEffect(() => {
    let mounted = true;
    void browser.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (!mounted || tab?.id === undefined || tab.id < 0) return;
        setTabId(tab.id);
        await sendCommand({ type: "popup:acknowledge-tab", tabId: tab.id });
      })
      .catch(() => {
        if (mounted)
          setMessage(
            "Could not refresh this tab. Saved discoveries are still in the dashboard.",
          );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  const open = async (hostname?: string, view: "review" | "all" = "review") => {
    try {
      await openWorkspace(hostname, view);
      window.close();
    } catch {
      setMessage("Could not open workspace. Try again.");
    }
  };
  return (
    <PopupView
      buckets={buckets}
      loading={loading}
      discoveries={tabId === undefined ? [] : (tabs[tabId] ?? [])}
      recording={recording}
      message={message}
      open={(hostname, view) => void open(hostname, view)}
      toggle={() =>
        void sendCommand({ type: "recording:set", enabled: !recording }).catch(
          () => setMessage("Could not change recording."),
        )
      }
    />
  );
}
