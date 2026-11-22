import { useState } from "react";
import type { IBucket, IAccessCheck } from "@/@types";
import { openWorkspace } from "@/lib/workspace-client";
import { sendMessage } from "webext-bridge/popup";
import useBucket from "@/lib/store/useBucket.store";

const time = (value?: number) =>
  value === undefined ? "Unknown" : new Date(value).toLocaleString();
const resultText = {
  allowed: "Allowed",
  denied: "Blocked",
  missing: "Bucket not found",
  unknown: "Unclear",
  "not-checked": "Not checked",
};

function CheckResult({
  title,
  check,
}: {
  title: string;
  check?: IAccessCheck;
}) {
  return (
    <div className="space-y-1 border-b pb-3">
      <p className="font-semibold">
        {title}: {check ? resultText[check.result] : "Not checked"}
      </p>
      {check && (
        <p>
          Checked: {time(check.at)}
          {check.status ? ` · HTTP ${check.status}` : ""}
        </p>
      )}
      {check?.endpoint && <p className="break-all">{check.endpoint}</p>}
    </div>
  );
}

export function BucketDetailsBody({ bucket }: { bucket: IBucket }) {
  const { setBuckets } = useBucket();
  const [notes, setNotes] = useState(bucket.notes ?? "");
  const [reviewStatus, setReviewStatus] = useState<
    NonNullable<IBucket["reviewStatus"]>
  >(bucket.reviewStatus ?? "todo");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    setMessage("");
    try {
      setBuckets(
        await sendMessage("buckets:retry", bucket.hostname, "background"),
      );
    } catch {
      setMessage("Could not check. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      setBuckets(
        await sendMessage(
          "buckets:annotate",
          {
            hostname: bucket.hostname,
            notes,
            reviewStatus,
          },
          "background",
        ),
      );
      setMessage("Saved on this device.");
    } catch {
      setMessage("Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-1 break-all">
        <h3 className="font-bold">Bucket</h3>
        <p>Name: {bucket.endpoint?.bucket ?? "Unknown"}</p>
        <p>Region: {bucket.endpoint?.region ?? "Unknown"}</p>
        <p>Partition: {bucket.endpoint?.partition ?? "Unknown"}</p>
        <p>Address type: {bucket.endpoint?.kind ?? "Older record"}</p>
        <p>
          {bucket.endpoint?.bucket
            ? "Name found in an S3 address."
            : "The origin bucket is not known. A custom or CDN address does not reveal it."}
        </p>
      </section>
      <section className="space-y-3">
        <h3 className="font-bold">Access checks</h3>
        <p>
          Listing and ACL checks use unsigned requests. These are separate
          permissions, not a public/private verdict.
        </p>
        <CheckResult title="List files" check={bucket.access?.listing} />
        <CheckResult title="Read ACL" check={bucket.access?.acl} />
        {(bucket.access?.listing?.result === "missing" ||
          bucket.access?.acl?.result === "missing" ||
          bucket.owned === false) && (
          <p>
            Bucket not found. This does not prove that its name can be claimed.
          </p>
        )}
        {bucket.access?.file && (
          <p>
            File seen: HTTP {bucket.access.file.status} at{" "}
            {time(bucket.access.file.at)}.{" "}
            {bucket.access.file.context === "signed"
              ? "A signed link was used."
              : "A successful browser response was seen; anonymous access was not tested."}
          </p>
        )}
        {bucket.access?.signedLink && (
          <p>
            Signed link seen. This is temporary access, not proof of public
            access.
          </p>
        )}
        {!bucket.access?.listing && (
          <p>Older result. Check again for operation-specific results.</p>
        )}
        {bucket.endpoint?.kind === "custom" && (
          <p>
            Bucket API checks are not available until the bucket name is known.
          </p>
        )}
        <p>Last check: {time(bucket.checkedAt)}</p>
        <button
          className="text-primary underline disabled:opacity-50"
          disabled={
            busy ||
            bucket.checkStatus === "checking" ||
            bucket.endpoint?.kind === "custom"
          }
          onClick={retry}
        >
          {busy ? "Working…" : "Check again"}
        </button>
        <p>
          Blocked listing does not mean files are private. Readable ACLs do not
          prove that files are public. Accessible files are not automatically
          vulnerabilities.
        </p>
      </section>
      <section className="space-y-1 break-all">
        <h3 className="font-bold">Local history</h3>
        <p>First seen: {time(bucket.observations?.firstSeen ?? bucket.date)}</p>
        <p>Last seen: {time(bucket.observations?.lastSeen)}</p>
        <p>Sightings: {bucket.observations?.sightings ?? "Unknown"}</p>
        <p>Last response: {bucket.observations?.lastStatus ?? "Unknown"}</p>
        <p>Sites:</p>
        <ul>
          {(bucket.observations?.sources ?? [bucket.initiator])
            .filter(Boolean)
            .map((source) => (
              <li key={source}>{source}</li>
            ))}
        </ul>
        <p>Endpoints:</p>
        <ul>
          {bucket.observations?.endpoints.map((endpoint) => (
            <li key={endpoint}>{endpoint}</li>
          ))}
        </ul>
        <p>
          Only origins are saved, not full URLs or tokens. Up to 20 sites and
          endpoints.
        </p>
      </section>
      <section className="space-y-3">
        <h3 className="font-bold">Your review</h3>
        <label className="block">
          Status
          <select
            className="bg-background ml-2 rounded border p-1"
            value={reviewStatus}
            onChange={(event) =>
              setReviewStatus(event.target.value as typeof reviewStatus)
            }
          >
            <option value="todo">To check</option>
            <option value="expected">Expected</option>
            <option value="reported">Reported</option>
            <option value="fixed">Fixed</option>
          </select>
        </label>
        <p>This is your label, not a verified retest result.</p>
        <label className="block">
          Notes
          <textarea
            className="bg-background mt-1 min-h-24 w-full rounded border p-2"
            maxLength={4000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <button
          className="text-primary underline disabled:opacity-50"
          onClick={save}
          disabled={busy}
        >
          Save
        </button>
        <p role="status">{message}</p>
        <p>
          Notes stay on this device and are not included in downloads. Sanitized
          check history can be exported. Deleting this bucket removes its local
          data.
        </p>
      </section>
    </div>
  );
}

export default function BucketDetails({ bucket }: { bucket: IBucket }) {
  return (
    <button
      className="text-primary text-xs underline"
      onClick={() => void openWorkspace(bucket.hostname)}
    >
      Details
    </button>
  );
}
