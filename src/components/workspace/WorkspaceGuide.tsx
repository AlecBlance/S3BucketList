import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { workspaceIntroStorage } from "@/lib/storage";

function WorkspaceGuideNotes() {
  return (
    <dl className="workspace-guide-notes">
      <dt>What it does</dt>
      <dd>
        Finds S3 buckets in recorded traffic and automatically checks listing
        and access rules (ACLs). Manually added buckets are saved without
        scanning. File metadata and one-byte reads are opt-in.
      </dd>
      <dt>What it doesn’t do</dt>
      <dd>
        No uploads, deletes, permission changes, or AWS credentials. Listing and
        ACL results don’t prove file or write access.
      </dd>
      <dt>What stays on your device</dt>
      <dd>
        Discoveries, notes, and history stay local. Evidence omits file paths,
        signing credentials, and file content. Exports also omit notes.
      </dd>
    </dl>
  );
}

export default function WorkspaceGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    void workspaceIntroStorage
      .getValue()
      .then((seen) => {
        if (mounted && !seen) setOpen(true);
      })
      .catch(() => {
        // The workspace and manually opened guide still work if this read fails.
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          void workspaceIntroStorage.setValue(true).catch(() => undefined);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="button">
          About S3BucketList
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content
          className="review-modal"
          onCloseAutoFocus={(event) => {
            // The first-open dialog may have no visible trigger to return to.
            const tools =
              document.querySelector<HTMLDetailsElement>(".workspace-tools");
            if (!tools?.open) {
              event.preventDefault();
              document
                .querySelector<HTMLButtonElement>(
                  ".collection-tabs [aria-current]",
                )
                ?.focus();
            }
          }}
        >
          <Dialog.Title>
            About S3BucketList{" "}
            {import.meta.env.VITE_VERSION && (
              <small className="quiet">v{import.meta.env.VITE_VERSION}</small>
            )}
          </Dialog.Title>
          <Dialog.Description>
            Read-only checks for AWS S3. Only test buckets you’re authorized to
            check.
          </Dialog.Description>
          <WorkspaceGuideNotes />
          <p className="help-text">Available anytime under Workspace tools.</p>
          <p className="about-links">
            <a
              href="https://github.com/AlecBlance/S3BucketList/issues"
              target="_blank"
              rel="noreferrer"
            >
              Help / Report an issue
            </a>
            <a
              href="https://chromewebstore.google.com/detail/s3bucketlist/anngjobjhcbancaaogmlcffohpmcniki/reviews"
              target="_blank"
              rel="noreferrer"
            >
              Rate on Chrome Web Store
            </a>
            <a href="https://alecblance.com" target="_blank" rel="noreferrer">
              By Alec Blance
            </a>
          </p>
          <Dialog.Close className="button primary">Got it</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
