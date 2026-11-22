import { useRef, useState } from "react";
import type { IBucket, IAccessCheck } from "@/@types";
import { confirmedAccess, reportedAcl } from "@/lib/bucket/triage";
import { parseS3Url } from "@/lib/bucket/endpoints";
import { SCAN_REASONS } from "@/lib/bucket/scan-copy";
import ObjectBrowser from "./ObjectBrowser";
import type { ObjectPreview } from "@/lib/bucket/browse";
import { permissionTone } from "@/lib/bucket/status-tone";
import "./status-label.css";

const stateName = {
  allowed: "Allowed",
  denied: "Denied",
  missing: "Not found",
  unknown: "No result",
  "not-checked": "Not tested",
};
export default function PermissionResults({
  bucket,
  verify,
  browse,
}: {
  bucket: IBucket;
  verify(
    hostname: string,
    url: string,
    content?: boolean,
  ): Promise<IAccessCheck>;
  browse(hostname: string, prefix: string): Promise<ObjectPreview>;
}) {
  const [url, setUrl] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [content, setContent] = useState(false);
  const [fileToolsOpen, setFileToolsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const fileTrigger = useRef<HTMLElement>(null);
  const fileTools = useRef<HTMLDetailsElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const closeFileForm = () => {
    setUrl("");
    setApproved(false);
    if (fileTools.current) fileTools.current.open = false;
    setContent(false);
    setError("");
    requestAnimationFrame(() =>
      fileTrigger.current?.focus({ preventScroll: true }),
    );
  };
  const earlier = confirmedAccess(bucket);
  const grants = reportedAcl(bucket);
  const rows = [
    {
      id: "listing" as const,
      label: "List filenames",
      check: bucket.access?.listing,
      allowed:
        bucket.access?.listing?.keysReturned === 1
          ? "S3 returned one filename. It wasn’t saved."
          : bucket.access?.listing?.keysReturned === 0
            ? "Listing was allowed, but no filenames were returned."
            : "Confirmed by an earlier scan.",
      denied:
        "This request was denied. Prefix-restricted listing may still work.",
    },
    {
      id: "acl" as const,
      label: "Read bucket access rules",
      check: bucket.access?.acl,
      allowed:
        grants.AllUsers?.length || grants.AuthenticatedUsers?.length
          ? "See Reported access grants below."
          : "No broad grants were reported.",
      denied: "This does not decide listing or file access.",
    },
    {
      id: "content" as const,
      label: "Read a file's content",
      check: bucket.objectRead,
      allowed:
        "An unsigned range request returned exactly one byte. The byte was discarded.",
      denied:
        "This file request was denied. Other files may have different permissions.",
    },
    {
      id: "object" as const,
      label: "Read a file's metadata",
      check: bucket.objectHead,
      allowed:
        "Metadata for one file was accessible. No file body was downloaded.",
      denied: "The file request was denied. It may be inaccessible or absent.",
    },
  ].filter((row) => row.check && row.check.result !== "not-checked");
  const test = async () => {
    setError("");
    setAnnouncement("");
    try {
      const parsed = new URL(url.trim());
      const endpoint = parseS3Url(parsed.href);
      const expected =
        bucket.endpoint ?? parseS3Url(`https://${bucket.hostname}/`);
      if (
        parsed.protocol !== "https:" ||
        parsed.search ||
        parsed.hash ||
        parsed.username ||
        parsed.password ||
        parsed.port
      )
        throw new Error(
          "Use HTTPS without query parameters, signing credentials, or a fragment.",
        );
      if (
        !expected?.bucket ||
        endpoint?.key !== expected.key ||
        !endpoint.object
      )
        throw new Error(
          "Enter a direct S3 file URL for this bucket, not a bucket root or CDN URL.",
        );
      setBusy(true);
      const result = await verify(bucket.hostname, url.trim(), content);
      closeFileForm();
      setAnnouncement(
        `File ${content ? "content" : "metadata"}: ${stateName[result.result].toLowerCase()}.`,
      );
    } catch (error) {
      setError(
        error instanceof TypeError
          ? "Enter a complete HTTPS file URL."
          : error instanceof Error
            ? error.message
            : "The file test failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const names: Record<string, string> = {
    READ: "list files",
    READ_ACP: "read access rules",
    WRITE: "create/delete objects",
    WRITE_ACP: "change access rules",
    FULL_CONTROL: "all bucket ACL permissions",
  };
  return (
    <section className="permission-section">
      <span className="file-check-announcement" role="status">
        {announcement}
      </span>
      <div className="section-heading">
        <h2>Anonymous access</h2>
      </div>
      {rows.length ? (
        <div
          className="permission-table"
          role="table"
          aria-label="Permission checks"
        >
          {rows.map((row) => (
            <div className="permission-row" role="row" key={row.id}>
              <div role="cell">
                <strong>{row.label}</strong>
                <p>
                  {row.check?.result === "allowed"
                    ? row.allowed
                    : row.check?.result === "denied"
                      ? row.denied
                      : (row.id === "object" || row.id === "content") &&
                          row.check?.reason === "wrong-region"
                        ? "Run a bucket scan to learn the region, then retry this file URL."
                        : row.check?.reason
                          ? SCAN_REASONS[row.check.reason]
                          : row.check?.result === "missing"
                            ? "S3 reported not found. See the request inspector."
                            : "The check was inconclusive."}
                  {(row.check?.result === "unknown" ||
                    ((row.id === "object" || row.id === "content") &&
                      row.check?.result !== "allowed")) &&
                    earlier[row.id] === "allowed" &&
                    ` Earlier access evidence is still on record.${row.id === "object" || row.id === "content" ? " File tests may refer to different files." : ""}`}
                </p>
              </div>
              <div role="cell">
                <span
                  className="permission-result"
                  data-tone={permissionTone(row.check?.result, row.id)}
                >
                  {row.check ? stateName[row.check.result] : "Not tested"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="help-text">
          No results yet. Scan the bucket to check listing and access rules.
        </p>
      )}
      {(bucket.endpoint ?? parseS3Url(`https://${bucket.hostname}/`))
        ?.apiUrl && (
        <details
          ref={fileTools}
          className="detail-disclosure file-tools"
          onToggle={(event) => {
            const open = event.currentTarget.open;
            setFileToolsOpen(open);
            if (!open) {
              setUrl("");
              setApproved(false);
              setContent(false);
              setError("");
            }
          }}
        >
          <summary ref={fileTrigger}>Test a file</summary>
          {fileToolsOpen && (
            <div className="disclosure-content">
              <form
                id="file-test"
                className="file-test-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (approved && !busy) void test();
                }}
              >
                <label className="field-label" htmlFor="file-test-url">
                  Direct S3 file URL
                </label>
                <input
                  ref={fileInput}
                  id="file-test-url"
                  className="field"
                  type="url"
                  disabled={busy}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    setApproved(false);
                  }}
                  placeholder="https://bucket.s3.amazonaws.com/path/to/file"
                  aria-describedby="file-test-help"
                  required
                  maxLength={8192}
                />
                <label className="field-label" htmlFor="file-test-method">
                  Check
                </label>
                <select
                  id="file-test-method"
                  className="field"
                  value={content ? "content" : "metadata"}
                  disabled={busy}
                  aria-describedby="file-test-help"
                  onChange={(event) => {
                    setContent(event.target.value === "content");
                    setApproved(false);
                  }}
                >
                  <option value="metadata">Metadata only (HEAD)</option>
                  <option value="content">
                    Content access (request one byte)
                  </option>
                </select>
                <p id="file-test-help" className="help-text">
                  {content
                    ? "Requests one byte. If S3 ignores the range, the response is cancelled, though extra bytes may already have been sent."
                    : "Checks metadata without reading the file body."}{" "}
                  No sign-in required. File URLs and content aren’t saved.
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={approved}
                    onChange={(event) => setApproved(event.target.checked)}
                  />
                  This file is in my authorized testing scope.
                </label>
                {error && (
                  <p className="inline-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="button"
                  disabled={!approved || !url || busy}
                  type="submit"
                >
                  {busy ? "Testing…" : "Run file check"}
                </button>
              </form>
              <ObjectBrowser
                hostname={bucket.hostname}
                browse={browse}
                choose={(value) => {
                  if (busy) return;
                  setUrl(value);
                  setApproved(false);
                  setContent(false);
                  setError("");
                  requestAnimationFrame(() => fileInput.current?.focus());
                }}
              />
            </div>
          )}
        </details>
      )}
      {grants.AllUsers?.length || grants.AuthenticatedUsers?.length ? (
        <details className="detail-disclosure acl-grants">
          <summary>Reported access grants</summary>
          {grants.AllUsers?.length ? (
            <p>
              <strong>Everyone:</strong>{" "}
              {grants.AllUsers.map((value) => names[value] ?? value).join(", ")}
              .
            </p>
          ) : null}
          {grants.AuthenticatedUsers?.length ? (
            <p>
              <strong>Any AWS account:</strong>{" "}
              {grants.AuthenticatedUsers.map(
                (value) => names[value] ?? value,
              ).join(", ")}
              .
            </p>
          ) : null}
          <p className="help-text">
            Reported configuration, not a write test. Bucket policies, ownership
            settings, and Block Public Access may change what is effective.
          </p>
        </details>
      ) : null}
    </section>
  );
}
