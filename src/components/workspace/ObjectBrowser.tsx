import { useState } from "react";
import type { ObjectPreview } from "@/lib/bucket/browse";
import { SCAN_REASONS } from "@/lib/bucket/scan-copy";

export default function ObjectBrowser({
  hostname,
  browse,
  choose,
}: {
  hostname: string;
  browse(hostname: string, prefix: string): Promise<ObjectPreview>;
  choose(url: string): void;
}) {
  const [open, setOpen] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ObjectPreview>();
  const [error, setError] = useState("");
  return (
    <div>
      <button
        className="text-action"
        aria-expanded={open}
        aria-controls={open ? "object-preview-form" : undefined}
        disabled={busy}
        onClick={() => {
          setOpen(!open);
          setResult(undefined);
          setPrefix("");
          setApproved(false);
          setError("");
        }}
      >
        {open ? "Close file listing" : "Choose from a file listing…"}
      </button>
      {open && (
        <form
          id="object-preview-form"
          className="file-test-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!approved || busy) return;
            setResult(undefined);
            setError("");
            setBusy(true);
            try {
              setResult(await browse(hostname, prefix));
            } catch {
              setError("The preview failed. Check the bucket and try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field-label" htmlFor="object-prefix">
            File prefix (optional)
          </label>
          <input
            id="object-prefix"
            className="field"
            disabled={busy}
            value={prefix}
            autoComplete="off"
            spellCheck={false}
            maxLength={1024}
            onChange={(event) => {
              setPrefix(event.target.value);
              setApproved(false);
              setResult(undefined);
            }}
          />
          <p className="help-text">
            One listing request, at most 20 filenames. No pagination or
            automatic file requests. Filenames and this prefix stay in memory
            until you close this preview or leave this bucket.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              disabled={busy}
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />
            This bucket and prefix are in my authorized testing scope.
          </label>
          <button className="button" type="submit" disabled={busy || !approved}>
            {busy ? "Loading…" : "List up to 20 files"}
          </button>
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          {result && (
            <div aria-live="polite">
              <p className="help-text">
                {result.trace.reason === "confirmed"
                  ? `${result.objects.length} filenames returned.${result.truncated ? " More files exist; no further pages requested." : ""}`
                  : SCAN_REASONS[result.trace.reason]}{" "}
                {result.trace.status
                  ? `HTTP ${result.trace.status}`
                  : "No HTTP response"}{" "}
                · {result.trace.durationMs} ms
              </p>
              <ul className="object-preview">
                {result.objects.map((object) => (
                  <li key={object.key}>
                    <code>{object.key}</code>{" "}
                    <button
                      type="button"
                      className="text-action"
                      onClick={() => choose(object.url)}
                    >
                      Choose for file test
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
