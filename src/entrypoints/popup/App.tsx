import { useState } from "react";
import { ArrowUpRight, Pause, Play, Check } from "lucide-react";
import type { IBucket } from "@/@types";
import Brand from "@/components/workspace/Brand";
import StatusLabel from "@/components/workspace/StatusLabel";
import { useWorkspaceData } from "@/lib/hooks/useWorkspaceData";
import { openWorkspace, sendCommand } from "@/lib/workspace-client";
import {
  needsReview,
  referringSite,
  reviewReason,
  reviewHelpKey,
  sortForReview,
} from "@/lib/bucket/triage";
import "@/components/workspace/workspace.css";

export function PopupView({
  buckets,
  recording,
  open,
  toggle,
  message = "",
}: {
  buckets: IBucket[];
  recording: boolean;
  open(hostname?: string, view?: "review" | "all"): void;
  toggle(): void;
  message?: string;
}) {
  const review = sortForReview(buckets.filter(needsReview));
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
        <h1>
          Needs review <span>{review.length}</span>
        </h1>
        <p>Anonymous access was confirmed. Some access may be intentional.</p>
      </div>
      <div className="popup-list">
        {review.map((bucket) => (
          <div className="popup-bucket-item" key={bucket.hostname}>
            <button
              className="popup-bucket-row"
              aria-label={`View ${bucket.endpoint?.bucket ?? bucket.hostname}`}
              aria-describedby={`popup-reason-${encodeURIComponent(bucket.hostname)}`}
              onClick={() => open(bucket.hostname)}
            >
              <div>
                <strong title={bucket.endpoint?.bucket ?? bucket.hostname}>
                  {bucket.endpoint?.bucket ?? bucket.hostname}
                </strong>
                <span className="row-site">{referringSite(bucket)}</span>
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
        {!review.length && (
          <div className="empty-state small">
            <Check size={28} />
            <h3>Nothing needs review</h3>
            <p>
              No unreviewed access findings. Other discoveries are still saved.
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
      <p className="popup-privacy">
        Saved on this device. Expected buckets stay out of this list.
      </p>
    </div>
  );
}

export default function App() {
  const { buckets, recording } = useWorkspaceData();
  const [message, setMessage] = useState("");
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
