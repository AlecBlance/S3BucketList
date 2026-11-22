import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { parseBucketInput } from "@/lib/bucket/targets";
import { sendCommand } from "@/lib/workspace-client";
export default function AddBuckets({ onViewAll }: { onViewAll(): void }) {
  const [text, setText] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const add = async () => {
    setMessage("");
    setSaved(false);
    try {
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (!lines.length || lines.length > 100)
        throw new Error(
          "Enter between 1 and 100 bucket addresses, one per line.",
        );
      lines.forEach(parseBucketInput);
      setBusy(true);
      const result = await sendCommand<{ added: number }>({
        type: "buckets:add",
        inputs: lines,
      });
      setText("");
      setApproved(false);
      setSaved(true);
      setMessage(
        result.added
          ? `${result.added} ${result.added === 1 ? "bucket" : "buckets"} saved. No scans started.`
          : "These buckets are already saved. No scans started.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not add buckets. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (open) {
          setMessage("");
          setSaved(false);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button className="button">Add buckets…</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content className="review-modal">
          <Dialog.Title>Add buckets</Dialog.Title>
          <Dialog.Description>
            Paste exact bucket names or direct S3 bucket URLs, one per line. No
            name guessing or automatic scans.
          </Dialog.Description>
          <label className="field-label" htmlFor="bucket-targets">
            Bucket names or URLs
          </label>
          <textarea
            id="bucket-targets"
            className="field target-input"
            value={text}
            disabled={busy}
            maxLength={30_000}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setText(event.target.value);
              setMessage("");
              setSaved(false);
              setApproved(false);
            }}
            placeholder={
              "example-bucket\nhttps://example-bucket.s3.eu-west-1.amazonaws.com/"
            }
          />
          <p className="help-text">
            Bare names and s3:// names use commercial AWS. For China or
            GovCloud, enter the full regional S3 URL. File URLs, custom/CDN
            domains, and signed links are not accepted.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={approved}
              disabled={busy}
              onChange={(event) => setApproved(event.target.checked)}
            />
            I am authorized to test these buckets.
          </label>
          <p
            className={saved ? "help-text" : "inline-error"}
            role={saved ? "status" : "alert"}
          >
            {message}
          </p>
          <div className="button-row">
            <Dialog.Close className="button">Close</Dialog.Close>
            {saved ? (
              <Dialog.Close className="button primary" onClick={onViewAll}>
                View all discoveries
              </Dialog.Close>
            ) : (
              <button
                className="button primary"
                disabled={busy || !approved || !text.trim()}
                onClick={() => void add()}
              >
                {busy ? "Saving…" : "Add without scanning"}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
