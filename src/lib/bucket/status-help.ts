/** Shared copy for the popup, discovery list, and evidence page. */
export const STATUS_HELP: Record<string, string> = {
  "File content readable":
    "An explicit unsigned GET with Range: bytes=0-0 returned exactly one byte and a matching Content-Range. The byte was discarded. This proves anonymous content access for one file at that time, not write access or access to other files. No file path is saved.",
  "File metadata readable":
    "An explicit HEAD test read one file's metadata without cookies or AWS credentials. No body was downloaded. The file URL and path are not saved. This is stronger evidence than a file observed in normal browsing, but does not establish write access or impact.",
  "ACL reports public write access":
    "The readable ACL reports WRITE, WRITE_ACP, or FULL_CONTROL for Everyone. This is configured permission evidence, not an upload or ACL-change test. Policies, ownership settings, and Block Public Access may override the grant.",
  "Marked expected":
    "You marked this discovery as expected. Evidence is kept, but it no longer appears in Needs review. Newly confirmed access or broader ACL grants can reopen it; another sighting or an unclear retest will not.",
  "No anonymous listing or ACL access found":
    "These checks did not confirm unsigned listing or readable ACL access. Individual files may still be accessible. This is not proof that a bucket is private or secure.",
  "Bucket unknown":
    "S3 signs were seen at this address, but the bucket name is unknown. A custom domain or CDN can hide the origin bucket; some S3 address types are also unresolved. Listing and ACL checks need a known bucket API address, so Check again is unavailable. This does not mean the bucket is missing or vulnerable.",
  "Bucket not found":
    "S3 returned NoSuchBucket, or an older saved result reported a missing bucket. This does not prove the name can be claimed or that a takeover is possible.",
  "Can list":
    "An unsigned request returned an S3 file listing. This confirms listing access at the time of the check, not permission to read every file or write to the bucket.",
  "Listing blocked":
    "The unsigned listing request was denied. Individual files might still be readable; blocked listing does not mean the entire bucket is private.",
  "Listing unclear":
    "The listing check could not confirm access or denial, for example because of a network error or an unexpected response. It is not a private/public verdict or a confirmed fix.",
  "ACL readable":
    "An unsigned request returned the bucket's access control list (ACL). This does not by itself prove that files can be read or written.",
  "ACL blocked":
    "The unsigned request to read the access control list (ACL) was denied. Listing and file access are separate permissions.",
  "ACL unclear":
    "The access control list (ACL) check did not return a conclusive result. A network error or unexpected response is not proof that access was fixed.",
  "File seen":
    "The browser received a successful GET response for an S3 object. The request may have used a signed link or browser authentication; anonymous file access was not tested.",
  "Signed link seen":
    "A URL containing S3 signing parameters was observed in traffic or a page reference. A signed link is not proof of anonymous access. Signing credentials and full URLs are not saved.",
  "Older result":
    "This record predates the separate listing and ACL checks. Choose Check again on an identified bucket to get current operation-specific results.",
  "Not checked":
    "No completed check is available. Page references are saved without fetching targets; identified buckets discovered in traffic are queued automatically. Unknown bucket names cannot be checked.",
  Checking:
    "Unsigned listing and ACL requests are running. Each request has a timeout, and you can cancel the job in the check queue.",
  "Checking…":
    "Unsigned listing and ACL requests are running. Each request has a timeout, and you can cancel the job in the check queue.",
  Checked:
    "The check finished. Read the individual listing and ACL results: a finished check does not mean access was allowed.",
  "Check failed":
    "The check did not produce conclusive results. The discovery is still saved. Retry explicitly when ready; failure does not confirm a fix.",
  Queued:
    "This bucket is waiting for a check slot. Up to two buckets are checked at a time. You can cancel it in the check queue.",
  "Outdated · over 24h":
    "The last check is more than 24 hours old, so permissions may have changed. Choose Check again to refresh it. Age alone never starts another check.",
  queued:
    "Waiting for a check slot. Up to two buckets are checked at a time; queued work can be cancelled.",
  running:
    "Unsigned listing and ACL checks are running for this bucket. You can cancel the job.",
  done: "The job finished. Inspect the separate listing and ACL results; completion is not proof that access was allowed.",
  failed:
    "The job failed or could not produce conclusive results. Retry explicitly when ready. A failed check does not confirm a fix.",
  cancelled:
    "The job was cancelled. Any requests already sent cannot be recalled. Earlier saved results are not a new check.",
};
