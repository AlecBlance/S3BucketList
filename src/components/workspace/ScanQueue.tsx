import { X } from "lucide-react";
import type { IBucket, ICheckJob } from "@/@types";
import StatusLabel from "./StatusLabel";

export const jobLabel = {
  queued: "Queued",
  running: "Checking…",
  done: "Completed",
  failed: "Check unclear",
  cancelled: "Cancelled",
} satisfies Record<ICheckJob["state"], string>;

export const activeJob = (job: ICheckJob) =>
  job.state === "queued" || job.state === "running";

export const jobMatches = (job: ICheckJob, bucket: IBucket) =>
  job.hostname === bucket.hostname && job.recordId === bucket.recordId;

export default function ScanQueue({
  jobs,
  buckets,
  onSelect,
  onCancel,
  cancelling,
}: {
  jobs: ICheckJob[];
  buckets: IBucket[];
  onSelect(hostname: string): void;
  onCancel(id: string): void;
  cancelling: ReadonlySet<string>;
}) {
  const running = jobs.filter((job) => job.state === "running");
  const waiting = jobs.filter((job) => job.state === "queued");
  const recent = jobs
    .filter((job) => !activeJob(job))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

  return (
    <details className="scan-queue">
      <summary>
        Check queue
        <span role="status">
          {running.length || waiting.length
            ? `${running.length} running · ${waiting.length} waiting`
            : "No active scans"}
        </span>
      </summary>
      <div className="scan-queue-content">
        {!running.length && !waiting.length && (
          <p className="quiet">No buckets are running or waiting.</p>
        )}
        {[
          { label: "Running", items: running },
          { label: "Waiting", items: waiting },
          { label: "Recent scans", items: recent },
        ].map(({ label, items }) =>
          items.length ? (
            <section key={label} aria-label={label}>
              <h2>{label}</h2>
              <ul>
                {items.map((job) => (
                  <li className="queue-row" key={job.id}>
                    <div>
                      {buckets.some((bucket) => jobMatches(job, bucket)) ? (
                        <button onClick={() => onSelect(job.hostname)}>
                          {job.hostname}
                        </button>
                      ) : (
                        <span>{job.hostname}</span>
                      )}
                      {!activeJob(job) && (
                        <p>{new Date(job.updatedAt).toLocaleString()}</p>
                      )}
                    </div>
                    <StatusLabel
                      label={jobLabel[job.state]}
                      helpKey={job.state}
                    />
                    {activeJob(job) && (
                      <button
                        className="icon-button"
                        aria-label={`Cancel check for ${job.hostname}`}
                        title="Cancel check"
                        disabled={cancelling.has(job.id)}
                        onClick={() => onCancel(job.id)}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}
      </div>
    </details>
  );
}
