import type { IBucket, IScanAttempt } from "@/@types";
import { SCAN_REASONS } from "@/lib/bucket/scan-copy";
import { evidenceRecord } from "@/lib/bucket/evidence";
const names: Record<IScanAttempt["operation"], string> = {
  region: "Find bucket region",
  listing: "Test file listing",
  acl: "Read access rules",
  object: "Test file metadata",
  content: "Test file content · Range: bytes=0-0",
  browse: "Preview scoped listing",
};
export default function RequestInspector({
  bucket,
  notify,
}: {
  bucket: IBucket;
  notify(message: string): void;
}) {
  const objectTrace =
    bucket.checkHistory
      ?.slice()
      .reverse()
      .find((item) => item.objectHead)?.trace ?? [];
  const attempts = [...(bucket.scanTrace ?? []), ...objectTrace].sort(
    (a, b) => a.at - b.at,
  );
  const contentTrace =
    bucket.checkHistory
      ?.slice()
      .reverse()
      .find((item) => item.objectRead)?.trace ?? [];
  attempts.push(...contentTrace);
  attempts.sort((a, b) => a.at - b.at);
  return (
    <div className="disclosure-content">
      <p className="help-text">
        Only this extension's checks. No cookies, signing credentials, response
        bodies, or object paths are recorded.
      </p>
      {!attempts.length && (
        <p className="help-text">
          No request trace yet. Run a scan to record each request and result.
        </p>
      )}
      <ol className="request-trace">
        {attempts.map((attempt, index) => (
          <li key={`${attempt.at}:${index}`}>
            <div className="trace-heading">
              <strong>{names[attempt.operation]}</strong>
              <span>
                {attempt.status ? `HTTP ${attempt.status}` : "No HTTP response"}{" "}
                · {attempt.durationMs} ms
              </span>
            </div>
            <code>
              {attempt.method}{" "}
              {["object", "content", "browse"].includes(attempt.operation)
                ? "S3 object path omitted"
                : (attempt.endpoint ?? "Endpoint unavailable")}
            </code>
            <p>{SCAN_REASONS[attempt.reason]}</p>
            <div className="quiet">
              {attempt.errorCode && <span>S3 code: {attempt.errorCode}</span>}
              {attempt.region && <span>Region: {attempt.region}</span>}
              <time>{new Date(attempt.at).toLocaleString()}</time>
            </div>
          </li>
        ))}
      </ol>
      {!!attempts.length && (
        <button
          className="button"
          onClick={() =>
            void navigator.clipboard
              .writeText(JSON.stringify(evidenceRecord(bucket), null, 2))
              .then(() => notify("Sanitized debug info copied."))
              .catch(() =>
                notify("Could not copy debug info. Use Export instead."),
              )
          }
        >
          Copy debug info
        </button>
      )}
    </div>
  );
}
