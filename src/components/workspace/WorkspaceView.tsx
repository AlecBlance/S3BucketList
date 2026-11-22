import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Search,
  ArrowLeft,
  RefreshCw,
  Pause,
  Play,
  X,
  Check,
  Copy,
  Database,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import type { IBucket, ICheckJob, IAccessCheck } from "@/@types";
import Brand from "./Brand";
import StatusLabel from "./StatusLabel";
import PermissionResults from "./PermissionResults";
import RequestInspector from "./RequestInspector";
import ScanQueue, { activeJob, jobLabel, jobMatches } from "./ScanQueue";
import {
  discoveryStatus,
  discoveryStatuses,
  type DiscoveryStatus,
} from "./discovery-status";
import { findingLabels } from "@/lib/bucket/findings";
import { isStale, describeChange } from "@/lib/bucket/history";
import {
  confirmedAccess,
  needsReview,
  reviewReason,
  reviewSummary,
  referringSite,
  sortForReview,
  newlyAllowed,
  reviewHelpKey,
} from "@/lib/bucket/triage";
import {
  evidenceExport,
  findingDraft,
  reproductionCommands,
  handoffUrls,
  cliCommands,
} from "@/lib/bucket/evidence";
import { downloadText } from "@/lib/bucket/download";
import { parseS3Url } from "@/lib/bucket/endpoints";

export interface WorkspaceActions {
  select(hostname?: string): void;
  queue(hostnames: string[]): Promise<{ queued: number; skipped: number }>;
  cancel(id: string): Promise<void>;
  remove(hostname: string): Promise<void>;
  removeMany(hostnames: string[]): Promise<void>;
  save(
    hostname: string,
    notes: string,
    status: NonNullable<IBucket["reviewStatus"]>,
  ): Promise<void>;
  review(hostname: string, status: "expected" | "todo"): Promise<void>;
  recording(enabled: boolean): Promise<void>;
  verifyObject(
    hostname: string,
    url: string,
    content?: boolean,
  ): Promise<IAccessCheck>;
  browseObjects(
    hostname: string,
    prefix: string,
  ): Promise<import("@/lib/bucket/browse").ObjectPreview>;
}
export interface WorkspaceProps {
  settings?: ReactNode;
  tools?: ReactNode;
  addTargets?(onViewAll: () => void): ReactNode;
  buckets: IBucket[];
  jobs: ICheckJob[];
  recording: boolean;
  selected?: string;
  initialView?: "review" | "all";
  onViewChange?(view: "review" | "all"): void;
  actions: WorkspaceActions;
}
const date = (at?: number) =>
  at === undefined ? "Not checked" : new Date(at).toLocaleString();
const checkName = {
  allowed: "Allowed",
  denied: "Blocked",
  missing: "Bucket not found",
  unknown: "Unclear",
  "not-checked": "Not checked",
};
type NoteDraft = {
  notes?: string;
  status?: NonNullable<IBucket["reviewStatus"]>;
};
const draftKey = (bucket: IBucket) => bucket.recordId ?? bucket.hostname;

function evidenceAge(bucket: IBucket): string | undefined {
  const access = confirmedAccess(bucket);
  if (
    (access.listing === "allowed" &&
      bucket.access?.listing?.result === "unknown") ||
    (access.acl === "allowed" && bucket.access?.acl?.result === "unknown") ||
    (access.object === "allowed" && bucket.objectHead?.result !== "allowed") ||
    (access.content === "allowed" && bucket.objectRead?.result !== "allowed")
  )
    return "Earlier access evidence";
  if (isStale(bucket)) return "Scan older than 24h";
}

function Inspector({
  bucket,
  actions,
  jobs,
  notify,
  draft,
  onDraft,
}: {
  bucket: IBucket;
  actions: WorkspaceActions;
  jobs: ICheckJob[];
  notify(text: string, error?: boolean): void;
  draft?: NoteDraft;
  onDraft(draft?: NoteDraft): void;
}) {
  const notes = draft?.notes ?? bucket.notes ?? "";
  const status = draft?.status ?? bucket.reviewStatus ?? "todo";
  const [includeSites, setIncludeSites] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const latestJob =
    jobs.find((item) => jobMatches(item, bucket) && activeJob(item)) ??
    jobs
      .slice()
      .reverse()
      .find((item) => jobMatches(item, bucket));
  const job = latestJob && activeJob(latestJob) ? latestJob : undefined;
  const [startingScan, setStartingScan] = useState(false);
  const commands = reproductionCommands(bucket);
  const endpointUrl = handoffUrls([bucket]);
  const history = bucket.checkHistory ?? [];
  const expected = bucket.reviewStatus === "expected";
  const run = async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    try {
      await action();
      if (message) notify(message);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Action failed. Try again.",
        true,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="inspector">
      <header className="inspector-heading">
        <button className="back-link" onClick={() => actions.select()}>
          <ArrowLeft size={14} /> Back to discoveries
        </button>
        <div className="inspector-identity">
          <h1 tabIndex={-1}>{bucket.endpoint?.bucket ?? bucket.hostname}</h1>
          {bucket.endpoint?.bucket && (
            <p className="mono hostname">{bucket.hostname}</p>
          )}
          <p className="source-context">
            {referringSite(bucket).startsWith("http") ? (
              <>
                Seen on <strong>{referringSite(bucket)}</strong>
              </>
            ) : (
              referringSite(bucket)
            )}
          </p>
          <div className="status-line">
            <StatusLabel
              label={reviewReason(bucket)}
              helpKey={reviewHelpKey(bucket)}
            />
            {latestJob &&
              !job &&
              latestJob.state !== "done" &&
              reviewReason(bucket) !== jobLabel[latestJob.state] && (
                <span role="status" className="quiet">
                  {jobLabel[latestJob.state]}
                </span>
              )}
          </div>
          {evidenceAge(bucket) === "Earlier access evidence" && (
            <p className="quiet">
              Earlier access evidence is on record; the latest checks did not
              reconfirm all of it.
            </p>
          )}
        </div>
        <div className="inspector-actions">
          {commands && (
            <button
              className="button primary"
              disabled={busy || startingScan || !!job || !commands}
              onClick={async () => {
                notify("");
                setStartingScan(true);
                await run(async () => {
                  const result = await actions.queue([bucket.hostname]);
                  if (!result.queued)
                    throw new Error(
                      "Could not start the scan. Check the queue and try again.",
                    );
                });
                setStartingScan(false);
              }}
            >
              <RefreshCw size={15} />{" "}
              <span role="status">
                {startingScan && !job
                  ? "Starting…"
                  : job
                    ? jobLabel[job.state]
                    : bucket.checkedAt
                      ? "Scan again"
                      : "Scan bucket"}
              </span>
            </button>
          )}
          {(needsReview(bucket) || expected) && (
            <button
              className="text-action"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    actions.review(
                      bucket.hostname,
                      expected ? "todo" : "expected",
                    ),
                  expected
                    ? "Marked for review."
                    : "Marked expected. Evidence kept; this bucket will return if confirmed access changes.",
                )
              }
            >
              {expected ? "Undo expected" : "Mark expected"}
            </button>
          )}
          {job && (
            <button
              className="button"
              disabled={busy}
              onClick={() => void run(() => actions.cancel(job.id))}
            >
              Cancel check
            </button>
          )}
        </div>
      </header>
      <div className="inspector-content">
        {bucket.checkedAt && (
          <p className="quiet scan-time">
            Last bucket scan: {date(bucket.checkedAt)}
            {isStale(bucket) && " · Older than 24 hours"}
            {job && " · Showing saved results until this scan finishes"}
          </p>
        )}
        <div className="inspector-body-grid">
          <div className="bucket-results">
            {commands ? (
              <PermissionResults
                bucket={bucket}
                verify={actions.verifyObject}
                browse={actions.browseObjects}
              />
            ) : (
              <section className="confirmed-summary">
                <p>{reviewSummary(bucket)}</p>
              </section>
            )}
          </div>
          <aside className="bucket-tools" aria-label="Bucket tools">
            <h2>Bucket tools</h2>
            <details className="detail-disclosure bucket-more">
              <summary>Technical details</summary>
              <div className="disclosure-content">
                <details className="detail-disclosure">
                  <summary>Request inspector</summary>
                  <RequestInspector bucket={bucket} notify={notify} />
                </details>
                <details className="detail-disclosure">
                  <summary>Bucket details &amp; observed traffic</summary>
                  <div className="disclosure-content">
                    {endpointUrl && (
                      <a
                        className="text-action endpoint-link"
                        href={endpointUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open S3 endpoint ↗
                      </a>
                    )}
                    <div className="status-line">
                      {findingLabels(bucket)
                        .filter((label) =>
                          [
                            "File seen",
                            "Signed link seen",
                            "Older result",
                          ].includes(label),
                        )
                        .map((label) => (
                          <StatusLabel
                            key={label}
                            className="status-chip"
                            label={label}
                          />
                        ))}
                    </div>
                    {bucket.access?.file && (
                      <p className="help-text">
                        File response: HTTP {bucket.access.file.status} ·{" "}
                        {date(bucket.access.file.at)} ·{" "}
                        {bucket.access.file.context === "signed"
                          ? "Signed link"
                          : "Browser context"}
                        . Anonymous file access was not tested.
                      </p>
                    )}
                    <dl className="fact-grid">
                      <div>
                        <dt>Bucket</dt>
                        <dd>{bucket.endpoint?.bucket ?? "Unknown"}</dd>
                      </div>
                      <div>
                        <dt>Region</dt>
                        <dd>{bucket.endpoint?.region ?? "Unknown"}</dd>
                      </div>
                      <div>
                        <dt>Partition</dt>
                        <dd>{bucket.endpoint?.partition ?? "Unknown"}</dd>
                      </div>
                      <div>
                        <dt>Address type</dt>
                        <dd>{bucket.endpoint?.kind ?? "Older record"}</dd>
                      </div>
                      <div>
                        <dt>First seen</dt>
                        <dd>
                          {date(bucket.observations?.firstSeen ?? bucket.date)}
                        </dd>
                      </div>
                      <div>
                        <dt>Last seen</dt>
                        <dd>{date(bucket.observations?.lastSeen)}</dd>
                      </div>
                      <div>
                        <dt>Traffic sightings</dt>
                        <dd>{bucket.observations?.sightings ?? "Unknown"}</dd>
                      </div>
                      <div>
                        <dt>Page references</dt>
                        <dd>{bucket.observations?.references ?? 0}</dd>
                      </div>
                      <div>
                        <dt>Last traffic response</dt>
                        <dd>
                          {bucket.observations?.lastStatus
                            ? `HTTP ${bucket.observations.lastStatus}`
                            : "Not available"}
                        </dd>
                      </div>
                    </dl>
                    <h3>Referring sites</h3>
                    <ul className="origin-list">
                      {bucket.observations?.sources.map((origin) => (
                        <li className="mono" key={origin}>
                          {origin}
                        </li>
                      ))}
                    </ul>
                    <h3>Observed endpoints</h3>
                    <ul className="origin-list">
                      {bucket.observations?.endpoints.map((origin) => (
                        <li className="mono" key={origin}>
                          {origin}
                        </li>
                      ))}
                    </ul>
                    <p className="help-text">
                      Origins only. Full URLs, object paths, query tokens,
                      cookies, and request headers are not stored.
                    </p>
                  </div>
                </details>
                <details className="detail-disclosure">
                  <summary>Check history ({history.length})</summary>
                  <div className="disclosure-content">
                    <p className="help-text">
                      An unclear retest is not a confirmed fix. Age alone never
                      starts another check.
                    </p>
                    {!history.length && (
                      <p className="help-text">No check history yet.</p>
                    )}
                    <ol className="timeline">
                      {history
                        .map((snapshot, index) => (
                          <li key={snapshot.id}>
                            <div className="timeline-head">
                              <strong>{date(snapshot.at)}</strong>
                              <StatusLabel
                                className="status-chip"
                                label={
                                  snapshot.state === "failed"
                                    ? "Unclear"
                                    : "Checked"
                                }
                                helpKey={
                                  snapshot.state === "failed"
                                    ? "Check failed"
                                    : "Checked"
                                }
                              />
                            </div>
                            <p>
                              {describeChange(history[index - 1], snapshot)}
                            </p>
                            <div className="timeline-results">
                              {snapshot.objectRead ? (
                                <span>
                                  File content:{" "}
                                  {snapshot.objectRead.result === "missing"
                                    ? "Not found"
                                    : checkName[snapshot.objectRead.result]}
                                </span>
                              ) : snapshot.objectHead ? (
                                <span>
                                  File metadata:{" "}
                                  {snapshot.objectHead.result === "missing"
                                    ? "Not found"
                                    : checkName[snapshot.objectHead.result]}
                                </span>
                              ) : (
                                <>
                                  <span>
                                    Listing:{" "}
                                    {snapshot.listing
                                      ? checkName[snapshot.listing.result]
                                      : "Not checked"}
                                  </span>
                                  <span>
                                    ACL:{" "}
                                    {snapshot.acl
                                      ? checkName[snapshot.acl.result]
                                      : "Not checked"}
                                  </span>
                                </>
                              )}
                            </div>
                          </li>
                        ))
                        .reverse()}
                    </ol>
                    <p className="help-text">
                      Up to 50 snapshots are kept, including the first result
                      and first access evidence.
                    </p>
                  </div>
                </details>
              </div>
            </details>
            <details className="detail-disclosure">
              <summary>Notes &amp; review status</summary>
              <div className="disclosure-content">
                <p className="help-text">
                  Notes stay on this device and are never exported. Review
                  labels are yours—not automatic conclusions.
                </p>
                <label className="field-label" htmlFor="review-status">
                  Review status
                </label>
                <select
                  id="review-status"
                  className="field"
                  value={status}
                  disabled={busy}
                  onChange={(event) =>
                    onDraft({
                      ...draft,
                      status: event.target.value as typeof status,
                    })
                  }
                >
                  <option value="todo">To check</option>
                  <option value="expected">Expected</option>
                  <option value="reported">Reported</option>
                  <option value="fixed">Fixed</option>
                </select>
                <label className="field-label" htmlFor="bucket-notes">
                  Notes
                </label>
                <textarea
                  id="bucket-notes"
                  className="field notes-field"
                  maxLength={4000}
                  value={notes}
                  disabled={busy}
                  onChange={(event) =>
                    onDraft({ ...draft, notes: event.target.value })
                  }
                  placeholder="Scope, expected behavior, next steps…"
                />
                <div className="section-heading">
                  <span className="quiet">
                    {draft
                      ? "Unsaved · kept while you switch buckets"
                      : `${notes.length}/4,000 characters`}
                  </span>
                  <button
                    className="button"
                    disabled={busy || !draft}
                    onClick={() =>
                      void run(async () => {
                        await actions.save(bucket.hostname, notes, status);
                        onDraft();
                      }, "Notes and review status saved.")
                    }
                  >
                    Save notes
                  </button>
                </div>
              </div>
            </details>
            <details className="detail-disclosure">
              <summary>Export &amp; CLI commands</summary>
              <div className="disclosure-content">
                <p className="help-text">
                  Sanitized evidence and history. Local notes, credentials,
                  object paths, and full request URLs are omitted.
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={includeSites}
                    onChange={(event) => setIncludeSites(event.target.checked)}
                  />
                  Include referring site origins in JSON
                </label>
                <div className="button-row">
                  <button
                    className="button"
                    onClick={() =>
                      downloadText(
                        "bucket-evidence.json",
                        JSON.stringify(
                          evidenceExport([bucket], includeSites),
                          null,
                          2,
                        ),
                        "application/json",
                      )
                    }
                  >
                    JSON evidence
                  </button>
                  <button
                    className="button"
                    onClick={() =>
                      downloadText(
                        "finding-draft.md",
                        findingDraft(bucket),
                        "text/markdown",
                      )
                    }
                  >
                    Finding draft
                  </button>
                  <button
                    className="button"
                    disabled={!commands}
                    onClick={() =>
                      downloadText("bucket-urls.txt", handoffUrls([bucket]))
                    }
                  >
                    URLs / Burp
                  </button>
                </div>
                <details className="command-disclosure">
                  <summary>Read-only commands</summary>
                  <p className="help-text">
                    Review these destinations and your authorization first. No
                    writes, object downloads, signed links, or credentials.
                  </p>
                  <pre className="code-block">
                    {commands || "No known bucket API address."}
                  </pre>
                  <h3>AWS CLI</h3>
                  <pre className="code-block">
                    {cliCommands(bucket) || "No known bucket API address."}
                  </pre>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={(event) => setReviewed(event.target.checked)}
                    />
                    I reviewed the destinations and my testing scope
                  </label>
                  <button
                    className="button"
                    disabled={!reviewed || !commands}
                    onClick={() =>
                      void run(
                        () => navigator.clipboard.writeText(commands),
                        "Commands copied.",
                      )
                    }
                  >
                    <Copy size={15} /> Copy cURL
                  </button>
                </details>
              </div>
            </details>
            <details className="detail-disclosure">
              <summary>Remove discovery</summary>
              <div className="disclosure-content">
                <p className="help-text">
                  Deletes its local notes, observations, check history, and
                  queue records. Running checks are cancelled.
                </p>
                {!confirmDelete ? (
                  <button
                    className="button danger"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Remove local discovery…
                  </button>
                ) : (
                  <div className="button-row">
                    <button
                      className="button danger"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await actions.remove(bucket.hostname);
                          onDraft();
                        }, "Local discovery removed.")
                      }
                    >
                      Yes, delete local data
                    </button>
                    <button
                      className="button"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep it
                    </button>
                  </div>
                )}
              </div>
            </details>
          </aside>
        </div>
      </div>
    </article>
  );
}

export default function WorkspaceView({
  buckets,
  jobs,
  recording,
  selected,
  actions,
  settings,
  tools,
  addTargets,
  initialView = "review",
  onViewChange,
}: WorkspaceProps) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState(initialView);
  const [statusFilter, setStatusFilter] = useState<"all" | DiscoveryStatus>(
    "all",
  );
  const [bulk, setBulk] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const notify = (text: string, error = false) =>
    setMessage(text ? { text, error } : undefined);
  useEffect(() => {
    if (!message || message.error) return;
    const timer = window.setTimeout(() => setMessage(undefined), 7000);
    return () => window.clearTimeout(timer);
  }, [message]);
  const [scanTargets, setScanTargets] = useState<IBucket[]>([]);
  const [removeTargets, setRemoveTargets] = useState<IBucket[]>([]);
  const [removing, setRemoving] = useState(false);
  const [drafts, setDrafts] = useState(new Map<string, NoteDraft>());
  const updateDraft = (bucket: IBucket, draft?: NoteDraft) =>
    setDrafts((current) => {
      const updated = new Map(current);
      const changed: NoteDraft = {};
      if (draft?.notes !== undefined && draft.notes !== (bucket.notes ?? ""))
        changed.notes = draft.notes;
      if (
        draft?.status !== undefined &&
        draft.status !== (bucket.reviewStatus ?? "todo")
      )
        changed.status = draft.status;
      if (changed.notes !== undefined || changed.status !== undefined)
        updated.set(draftKey(bucket), changed);
      else updated.delete(draftKey(bucket));
      return updated;
    });
  useEffect(() => {
    if (!drafts.size) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [drafts.size]);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());
  const bucket = buckets.find((item) => item.hostname === selected);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const previousBucket = useRef<string | undefined>(undefined);
  const changingCollection = useRef(false);
  const activeHostname = bucket?.hostname;
  useEffect(() => {
    const previous = previousBucket.current;
    previousBucket.current = activeHostname;
    const keepNavigationFocus = changingCollection.current;
    changingCollection.current = false;
    if (!window.matchMedia("(max-width: 750px)").matches) return;
    const root = workspaceRef.current;
    if (activeHostname) {
      root?.querySelector<HTMLElement>(".inspector-heading h1")?.focus();
    } else if (previous && !keepNavigationFocus) {
      const row = [
        ...(root?.querySelectorAll<HTMLButtonElement>(".bucket-row-main") ??
          []),
      ].find((button) => button.dataset.bucket === previous);
      (
        row ?? root?.querySelector<HTMLInputElement>(".workspace-search input")
      )?.focus();
    }
  }, [activeHostname]);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 750px)");
    const updateFocus = () => {
      const root = workspaceRef.current;
      if (
        narrow.matches &&
        root
          ?.querySelector(".bucket-list-pane")
          ?.contains(document.activeElement)
      )
        root.querySelector<HTMLElement>(".inspector-heading h1")?.focus();
    };
    narrow.addEventListener("change", updateFocus);
    return () => narrow.removeEventListener("change", updateFocus);
  }, []);
  const review = buckets.filter(needsReview);
  const pending = new Map(
    jobs.filter(activeJob).map((job) => [job.hostname, job]),
  );
  const getActive = (item: IBucket) => {
    const job = pending.get(item.hostname);
    return job && jobMatches(job, item) ? job : undefined;
  };
  const canScan = (item: IBucket) =>
    !getActive(item) &&
    !!(item.endpoint ?? parseS3Url(`https://${item.hostname}/`))?.apiUrl;
  const search = query.trim().toLowerCase();
  const searching = !!search || (view === "all" && statusFilter !== "all");
  const collection = view === "all" ? buckets : review;
  const searchMatches = collection.filter((item) =>
    [
      item.hostname,
      item.endpoint?.bucket,
      referringSite(item),
      ...(item.observations?.sources ?? []),
    ]
      .join(" ")
      .toLowerCase()
      .includes(search),
  );
  const byStatus = new Map<DiscoveryStatus, IBucket[]>();
  if (view === "all") {
    for (const item of searchMatches) {
      const status = discoveryStatus(item);
      for (const key of getActive(item) && status !== "in-progress"
        ? ([status, "in-progress"] as const)
        : [status]) {
        const group = byStatus.get(key) ?? [];
        group.push(item);
        byStatus.set(key, group);
      }
    }
  }
  const filtered = sortForReview(
    view === "all" && statusFilter !== "all"
      ? (byStatus.get(statusFilter) ?? [])
      : searchMatches,
  );
  const selectedBuckets = buckets.filter((item) =>
    selection.has(item.hostname),
  );
  const scanable = filtered.filter(canScan);
  const scanCount = Math.min(scanable.length, 100);
  const selectedScanable = selectedBuckets.filter(canScan);
  const exportShown = () =>
    downloadText(
      "shown-bucket-evidence.json",
      JSON.stringify(evidenceExport(filtered), null, 2),
      "application/json",
    );
  const removeTrigger = useRef<HTMLButtonElement>(null);
  const chooseView = (next: "review" | "all") => {
    changingCollection.current = !!bucket;
    setView(next);
    onViewChange?.(next);
    actions.select();
  };
  const perform = async (action: () => Promise<unknown>, text?: string) => {
    try {
      await action();
      if (text) notify(text);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Action failed. Try again.",
        true,
      );
    }
  };
  return (
    <div
      className={`workspace-app focused-workspace ${bucket ? "has-selection" : ""}`}
      ref={workspaceRef}
    >
      <main className="workspace-main">
        <header className="workspace-toolbar">
          <Brand />
          <div className="toolbar-actions">
            <span className="quiet">
              <span className={`recording-dot ${recording ? "on" : ""}`} />
              {recording ? "Recording" : "Paused"}
            </span>
            <button
              className="icon-button"
              aria-label={recording ? "Pause recording" : "Resume recording"}
              title={recording ? "Pause recording" : "Resume recording"}
              onClick={() =>
                void perform(
                  () => actions.recording(!recording),
                  recording ? "Recording paused." : "Recording resumed.",
                )
              }
            >
              {recording ? <Pause size={16} /> : <Play size={16} />}
            </button>
            {settings}
            {addTargets?.(() => {
              setQuery("");
              setStatusFilter("all");
              chooseView("all");
            })}
            <details className="workspace-tools">
              <summary>Workspace tools</summary>
              <div className="tools-content">
                {tools}
                <button
                  className="button"
                  disabled={!buckets.length}
                  onClick={() =>
                    downloadText(
                      "bucket-evidence.json",
                      JSON.stringify(
                        evidenceExport(
                          selectedBuckets.length ? selectedBuckets : buckets,
                        ),
                        null,
                        2,
                      ),
                      "application/json",
                    )
                  }
                >
                  Export {selectedBuckets.length ? "selected" : "all"} evidence
                </button>
                <button
                  className="button"
                  onClick={(event) => {
                    setBulk(!bulk);
                    if (bulk) setSelection(new Set());
                    if (!bulk) {
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      if (
                        window.matchMedia("(max-width: 750px)").matches &&
                        bucket
                      )
                        actions.select();
                      else
                        workspaceRef.current
                          ?.querySelector<HTMLInputElement>(
                            ".workspace-search input",
                          )
                          ?.focus();
                    }
                  }}
                >
                  {bulk ? "Hide selection controls" : "Select multiple buckets"}
                </button>
              </div>
            </details>
          </div>
        </header>
        <nav className="collection-tabs" aria-label="Discoveries">
          <button
            aria-current={view === "review" ? "page" : undefined}
            onClick={() => view !== "review" && chooseView("review")}
          >
            Needs review <span>{review.length}</span>
          </button>
          <button
            aria-current={view === "all" ? "page" : undefined}
            onClick={() => view !== "all" && chooseView("all")}
          >
            All discoveries <span>{buckets.length}</span>
          </button>
        </nav>
        <ScanQueue
          jobs={jobs}
          buckets={buckets}
          cancelling={cancelling}
          onSelect={(hostname) => {
            workspaceRef.current
              ?.querySelector<HTMLDetailsElement>(".scan-queue")
              ?.removeAttribute("open");
            actions.select(hostname);
            // A queue link should land in the inspector even on desktop.
            requestAnimationFrame(() =>
              workspaceRef.current
                ?.querySelector<HTMLElement>(".inspector-heading h1")
                ?.focus(),
            );
          }}
          onCancel={(id) => {
            setCancelling((current) => new Set(current).add(id));
            void perform(() => actions.cancel(id)).finally(() =>
              setCancelling((current) => {
                const next = new Set(current);
                next.delete(id);
                return next;
              }),
            );
          }}
        />
        {message && (
          <div
            className="workspace-message"
            role={message.error ? "alert" : "status"}
          >
            <span>{message.text}</span>
            <button
              aria-label="Dismiss message"
              onClick={() => setMessage(undefined)}
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="workspace-columns">
          <section className="bucket-list-pane" aria-label="Saved buckets">
            <label className="workspace-search">
              <Search size={16} />
              <input
                aria-label="Search buckets or sites"
                placeholder="Search buckets or sites…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {view === "all" && (
              <label className="status-filter">
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (
                      value === "all" ||
                      discoveryStatuses.some(([id]) => id === value)
                    )
                      setStatusFilter(value as "all" | DiscoveryStatus);
                  }}
                >
                  <option value="all">
                    All statuses ({searchMatches.length})
                  </option>
                  {discoveryStatuses.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label} ({byStatus.get(id)?.length ?? 0})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(searching || view === "all") && (
              <div className="discovery-results">
                <span role="status">
                  {filtered.length} of {collection.length} discoveries
                </span>
                <button
                  type="button"
                  className="text-action"
                  disabled={!filtered.length}
                  onClick={exportShown}
                >
                  Export shown
                </button>
                {searching && (
                  <button
                    className="text-action"
                    onClick={() => {
                      setQuery("");
                      if (view === "all") setStatusFilter("all");
                      workspaceRef.current
                        ?.querySelector<HTMLInputElement>(
                          ".workspace-search input",
                        )
                        ?.focus();
                    }}
                  >
                    Clear {view === "all" ? "filters" : "search"}
                  </button>
                )}
              </div>
            )}
            {filtered.length > 0 && (
              <div className="list-scan-action">
                <button
                  type="button"
                  className="text-action"
                  disabled={!scanCount}
                  onClick={() => setScanTargets(scanable.slice(0, scanCount))}
                >
                  {scanCount
                    ? `Scan ${scanCount}${scanable.length > scanCount ? ` of ${scanable.length}` : ""} eligible ${scanCount === 1 ? "bucket" : "buckets"}…`
                    : "No shown buckets ready to scan"}
                </button>
              </div>
            )}
            {bulk && selection.size > 0 && (
              <div className="selection-bar">
                <span>
                  {selectedBuckets.length} selected
                  {selectedBuckets.length >
                    filtered.filter((item) => selection.has(item.hostname))
                      .length && " · includes hidden rows"}
                </span>
                <button
                  disabled={
                    !selectedScanable.length || selectedScanable.length > 100
                  }
                  onClick={() => setScanTargets(selectedScanable)}
                >
                  Check selected
                </button>
                <button
                  ref={removeTrigger}
                  disabled={
                    !selectedBuckets.length || selectedBuckets.length > 100
                  }
                  onClick={() => setRemoveTargets(selectedBuckets)}
                >
                  Remove selected…
                </button>
                <button
                  aria-label="Clear selection"
                  onClick={() => setSelection(new Set())}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="bucket-scroll">
              {filtered.map((item) => {
                const active = getActive(item);
                const freshness = evidenceAge(item);
                return (
                  <div
                    className={`bucket-row ${item.hostname === selected ? "selected" : ""}`}
                    key={item.hostname}
                  >
                    {bulk && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.hostname}`}
                        checked={selection.has(item.hostname)}
                        onChange={(event) =>
                          setSelection((previous) => {
                            const next = new Set(previous);
                            if (event.target.checked) next.add(item.hostname);
                            else next.delete(item.hostname);
                            return next;
                          })
                        }
                      />
                    )}
                    <div className="bucket-row-content">
                      <button
                        className="bucket-row-main"
                        aria-label={`View ${item.endpoint?.bucket ?? item.hostname}`}
                        aria-current={
                          item.hostname === selected ? "true" : undefined
                        }
                        aria-describedby={`bucket-site-${encodeURIComponent(item.hostname)} bucket-reason-${encodeURIComponent(item.hostname)}`}
                        data-bucket={item.hostname}
                        onClick={() => actions.select(item.hostname)}
                      >
                        <strong title={item.endpoint?.bucket ?? item.hostname}>
                          {item.endpoint?.bucket ?? item.hostname}
                        </strong>
                        <span
                          className="row-site"
                          id={`bucket-site-${encodeURIComponent(item.hostname)}`}
                          title={referringSite(item)}
                        >
                          {referringSite(item)}
                        </span>
                      </button>
                      <div
                        className={`row-reason ${needsReview(item) ? "attention" : ""}`}
                        id={`bucket-reason-${encodeURIComponent(item.hostname)}`}
                      >
                        <StatusLabel
                          label={reviewReason(item)}
                          helpKey={reviewHelpKey(item)}
                        />
                        {active && (
                          <StatusLabel
                            label={jobLabel[active.state]}
                            helpKey={active.state}
                          />
                        )}
                        {needsReview(item) && newlyAllowed(item).length > 0 && (
                          <span className="change-label">Changed</span>
                        )}
                      </div>
                      {freshness && (
                        <small className="row-freshness">{freshness}</small>
                      )}
                    </div>
                  </div>
                );
              })}
              {!filtered.length && (
                <div className="empty-state small">
                  <Check size={28} />
                  <h3>
                    {searching
                      ? "No matching discoveries"
                      : view === "review"
                        ? "Nothing needs review"
                        : "No discoveries here yet"}
                  </h3>
                  <p>
                    {searching
                      ? "Try another search or clear the filters."
                      : view === "review"
                        ? "No unreviewed access findings. Blocked, untested, and unidentified addresses are in All discoveries."
                        : "Browse with recording on to save discoveries."}
                  </p>
                  {view === "review" && (
                    <button
                      className="button"
                      onClick={() => chooseView("all")}
                    >
                      View all discoveries
                    </button>
                  )}
                </div>
              )}
            </div>
            <footer className="list-pane-footer">
              <span className="local-dot" /> Stored on this device · notes stay
              private
            </footer>
          </section>
          {bucket ? (
            <Inspector
              key={bucket.recordId ?? bucket.hostname}
              bucket={bucket}
              actions={actions}
              jobs={jobs}
              notify={notify}
              draft={drafts.get(draftKey(bucket))}
              onDraft={(draft) => updateDraft(bucket, draft)}
            />
          ) : (
            <div className="empty-state workspace-welcome">
              <Database size={32} />
              <h1>
                {buckets.length ? "Select a bucket" : "Add a bucket to scan"}
              </h1>
              <p>
                {buckets.length
                  ? "View its permissions, test a file URL, or inspect scan requests."
                  : "Use Add buckets, or browse with Recording on to discover them."}
                <br />
                Use All discoveries to find blocked and untested buckets.
              </p>
            </div>
          )}
        </div>
      </main>
      <Dialog.Root
        open={removeTargets.length > 0}
        onOpenChange={(open) => {
          if (!open && !removing) setRemoveTargets([]);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="modal-backdrop" />
          <Dialog.Content
            className="review-modal"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              (
                removeTrigger.current ??
                workspaceRef.current?.querySelector<HTMLInputElement>(
                  ".workspace-search input",
                )
              )?.focus();
            }}
          >
            <Dialog.Title>
              Remove {removeTargets.length} local{" "}
              {removeTargets.length === 1 ? "discovery" : "discoveries"}?
            </Dialog.Title>
            <Dialog.Description>
              This removes the listed records, notes, and check history from
              this device. It does not delete anything from S3.
            </Dialog.Description>
            <pre className="code-block">
              {removeTargets.map((item) => item.hostname).join("\n")}
            </pre>
            <div className="button-row">
              <Dialog.Close className="button" disabled={removing}>
                Keep discoveries
              </Dialog.Close>
              <button
                className="button danger"
                disabled={removing}
                onClick={async () => {
                  const currentTargets = removeTargets.filter((target) =>
                    buckets.some(
                      (item) =>
                        item.hostname === target.hostname &&
                        item.recordId === target.recordId,
                    ),
                  );
                  if (currentTargets.length !== removeTargets.length) {
                    setRemoveTargets([]);
                    notify(
                      "The selected discoveries changed. Review the list and try again.",
                      true,
                    );
                    return;
                  }
                  setRemoving(true);
                  try {
                    await actions.removeMany(
                      currentTargets.map((item) => item.hostname),
                    );
                    for (const item of currentTargets) updateDraft(item);
                    setSelection(new Set());
                    setRemoveTargets([]);
                    notify(
                      `${currentTargets.length} local ${currentTargets.length === 1 ? "discovery" : "discoveries"} removed.`,
                    );
                  } catch {
                    setRemoveTargets([]);
                    notify(
                      "Could not remove the selected discoveries. Check the list before retrying.",
                      true,
                    );
                  } finally {
                    setRemoving(false);
                  }
                }}
              >
                {removing ? "Removing…" : "Remove local records"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={scanTargets.length > 0}
        onOpenChange={(open) => {
          if (!open && !submitting) setScanTargets([]);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="modal-backdrop" />
          <Dialog.Content className="review-modal">
            <Dialog.Title>Review these checks</Dialog.Title>
            <Dialog.Description>
              {scanTargets.length}{" "}
              {scanTargets.length === 1 ? "bucket" : "buckets"}. Each scan uses
              a region lookup and two permission requests. A regional redirect
              can add up to two retries per bucket. Confirm these destinations
              are within your testing scope.
            </Dialog.Description>
            <pre className="code-block">{handoffUrls(scanTargets)}</pre>
            <p className="help-text">No write tests or object downloads.</p>
            <div className="button-row">
              <Dialog.Close className="button" disabled={submitting}>
                Not now
              </Dialog.Close>
              <button
                className="button primary"
                disabled={submitting}
                onClick={async () => {
                  notify("");
                  setSubmitting(true);
                  try {
                    const result = await actions.queue(
                      scanTargets.map((item) => item.hostname),
                    );
                    setScanTargets([]);
                    const queue =
                      workspaceRef.current?.querySelector<HTMLDetailsElement>(
                        ".scan-queue",
                      );
                    if (queue && result.queued) queue.open = true;
                    if (result.skipped)
                      notify(
                        `${result.skipped} ${result.skipped === 1 ? "bucket was" : "buckets were"} not accepted. Check the queue before retrying.`,
                        !result.queued,
                      );
                  } catch {
                    setScanTargets([]);
                    notify(
                      "Could not start the scans. Check the queue before retrying.",
                      true,
                    );
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {submitting ? "Starting…" : "Start scans"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
