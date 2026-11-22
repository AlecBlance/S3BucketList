import type {
  IBucket,
  IAccessCheck,
  ICheckSnapshot,
  IScanAttempt,
  IAclPermissions,
} from "@/@types";
import { SCAN_REASONS } from "./scan-copy";
import { parseS3Url } from "./endpoints";
import { safeOrigin } from "./observations";

const cleanText = (value: string) =>
  value.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 500);
const validHost = (value: string) => {
  try {
    return new URL(`https://${value}/`).host;
  } catch {
    return "unknown";
  }
};
const listingQuery = "?list-type=2&max-keys=1";
const originalListingSuffix = (endpoint?: string) => {
  try {
    const query = new URL(endpoint!).searchParams;
    const limit = query.get("max-keys");
    return query.get("list-type") === "2" && ["0", "1"].includes(limit ?? "")
      ? `?list-type=2&max-keys=${limit}`
      : "";
  } catch {
    return "";
  }
};
const safeCode = (value?: string) =>
  [
    "AccessDenied",
    "NoSuchBucket",
    "NoSuchKey",
    "SlowDown",
    "ServiceUnavailable",
    "InternalError",
    "PermanentRedirect",
    "TemporaryRedirect",
    "AuthorizationHeaderMalformed",
    "IncorrectEndpoint",
    "AllAccessDisabled",
    "InvalidAccessKeyId",
    "RequestTimeTooSkewed",
    "InvalidRequest",
    "OtherS3Error",
  ].includes(value ?? "")
    ? value
    : undefined;
const safeGrants = (grants?: IAclPermissions) =>
  !grants
    ? undefined
    : Object.fromEntries(
        (["AllUsers", "AuthenticatedUsers", "LogDelivery"] as const).map(
          (group) => [
            group,
            (grants[group] ?? []).filter((value) =>
              [
                "READ",
                "WRITE",
                "READ_ACP",
                "WRITE_ACP",
                "FULL_CONTROL",
              ].includes(value),
            ),
          ],
        ),
      );
function safeTrace(trace: IScanAttempt) {
  const root = trace.endpoint ? parseS3Url(trace.endpoint)?.apiUrl : undefined;
  return {
    operation: trace.operation,
    method: trace.method,
    at: trace.at,
    durationMs: trace.durationMs,
    status: trace.status,
    endpoint: ["object", "content", "browse"].includes(trace.operation)
      ? undefined
      : root
        ? root +
          (trace.operation === "acl"
            ? "?acl"
            : trace.operation === "listing"
              ? originalListingSuffix(trace.endpoint)
              : "")
        : undefined,
    errorCode: safeCode(trace.errorCode),
    region:
      trace.region && /^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(trace.region)
        ? trace.region
        : undefined,
    reason: trace.reason in SCAN_REASONS ? trace.reason : "unexpected",
    authentication: "unsigned",
  };
}
function safeCheck(
  check: IAccessCheck | undefined,
  operation: "listing" | "acl" | "object",
) {
  if (!check) return;
  const root = check.endpoint ? parseS3Url(check.endpoint)?.apiUrl : undefined;
  return {
    result: check.result,
    at: check.at,
    status: check.status,
    authentication: "unsigned",
    endpoint:
      operation === "object"
        ? undefined
        : root
          ? root +
            (operation === "acl"
              ? "?acl"
              : originalListingSuffix(check.endpoint))
          : undefined,
    reason:
      check.reason && check.reason in SCAN_REASONS ? check.reason : undefined,
    errorCode: safeCode(check.errorCode),
    durationMs: check.durationMs,
    grants: safeGrants(check.grants),
    keysReturned:
      check.keysReturned === 0 || check.keysReturned === 1
        ? check.keysReturned
        : undefined,
  };
}
const safeSnapshot = (snapshot: ICheckSnapshot) => ({
  at: snapshot.at,
  state: snapshot.state,
  listing: safeCheck(snapshot.listing, "listing"),
  acl: safeCheck(snapshot.acl, "acl"),
  objectMetadata: safeCheck(snapshot.objectHead, "object"),
  objectContent: safeCheck(snapshot.objectRead, "object"),
  requests: snapshot.trace?.map(safeTrace),
});

/** An explicit allowlist: no notes, tokens, paths, owner IDs, or raw request data. */
export function evidenceRecord(bucket: IBucket, includeSites = false) {
  const endpoint = bucket.endpoint ?? parseS3Url(`https://${bucket.hostname}/`);
  return {
    hostname: validHost(bucket.hostname),
    bucket: endpoint?.bucket,
    region: endpoint?.region,
    partition: endpoint?.partition,
    identity: endpoint?.bucket ? "name in S3 address" : "origin bucket unknown",
    discovery: bucket.discovery ?? "traffic",
    firstSeen: bucket.observations?.firstSeen ?? bucket.date,
    lastSeen: bucket.observations?.lastSeen,
    sightings: bucket.observations?.sightings,
    references: bucket.observations?.references,
    checkedAt: bucket.checkedAt,
    checkStatus: bucket.checkStatus,
    checks: {
      listing: safeCheck(bucket.access?.listing, "listing"),
      acl: safeCheck(bucket.access?.acl, "acl"),
      objectMetadata: safeCheck(bucket.objectHead, "object"),
      objectContent: safeCheck(bucket.objectRead, "object"),
    },
    requests: bucket.scanTrace?.map(safeTrace),
    fileResponse: bucket.access?.file
      ? {
          at: bucket.access.file.at,
          status: bucket.access.file.status,
          context: bucket.access.file.context,
          anonymousAccessTested: false,
        }
      : undefined,
    signedLinkSeen: !!bucket.access?.signedLink,
    history: bucket.checkHistory?.map(safeSnapshot),
    sites: includeSites
      ? [
          ...new Set(
            bucket.observations?.sources.map(safeOrigin).filter(Boolean),
          ),
        ]
      : undefined,
    redaction: {
      fullUrls: "omitted",
      objectPaths: "omitted",
      credentials: "omitted",
      notes: "omitted",
      siteOrigins: includeSites ? "included by request" : "omitted",
    },
  };
}

export const evidenceExport = (buckets: IBucket[], includeSites = false) => ({
  schemaVersion: 1,
  exportedAt: Date.now(),
  localOnly: true,
  includesSiteOrigins: includeSites,
  buckets: buckets.map((bucket) => evidenceRecord(bucket, includeSites)),
});

function markdownText(value: string) {
  return cleanText(value).replace(/[\\`*_{}\[\]<>#|]/g, "\\$&");
}
export function findingDraft(bucket: IBucket): string {
  const data = evidenceRecord(bucket);
  return `# S3 observation: ${markdownText(data.hostname)}

## Observed results
- Listing request: ${data.checks.listing?.result ?? "not checked"}${data.checks.listing?.keysReturned !== undefined ? ` (${data.checks.listing.keysReturned} name returned; discarded, not saved)` : ""}
- Read ACL: ${data.checks.acl?.result ?? "not checked"}
- Last check: ${data.checkedAt ? new Date(data.checkedAt).toISOString() : "not checked"}
- Signed link seen: ${data.signedLinkSeen ? "yes" : "no"}
- File metadata test: ${data.checks.objectMetadata?.result ?? "not tested"} (HEAD only, no body downloaded)
- File content test: ${data.checks.objectContent?.result ?? "not tested"} (GET Range: bytes=0-0; confirmation requires a valid one-byte response; no content saved)
- ACL grants for Everyone: ${data.checks.acl?.grants ? data.checks.acl.grants.AllUsers?.join(", ") || "none returned" : "not captured"} (reported configuration, not a write test)

## Scope and limits
Listing and ACL checks are unsigned and test separate operations.
A browser file response does not establish anonymous object access.
A missing bucket does not establish takeover. No severity or business impact is assumed.

## Reproduction
Review the destinations and your authorization before using these read-only commands.

\`\`\`sh
${reproductionCommands(bucket) || "# No known bucket API endpoint. Confirm the bucket identity first."}
\`\`\`

## Impact
To be assessed by the tester.

## Redaction
Full URLs, object paths, credentials, referring sites, and local notes are omitted.
`;
}

export function reproductionCommands(bucket: IBucket): string {
  const endpoint = bucket.endpoint ?? parseS3Url(`https://${bucket.hostname}/`);
  const root = endpoint?.apiUrl
    ? parseS3Url(endpoint.apiUrl)?.apiUrl
    : undefined;
  if (!root) return "";
  return [`${root}${listingQuery}`, `${root}?acl`]
    .map(
      (url) =>
        `curl --disable --request GET --proto '=https' --max-time 8 --max-redirs 0 --url '${url}'`,
    )
    .join("\n");
}

export function cliCommands(bucket: IBucket): string {
  const endpoint = bucket.endpoint ?? parseS3Url(`https://${bucket.hostname}/`);
  const parsed = endpoint?.apiUrl ? parseS3Url(endpoint.apiUrl) : undefined;
  if (!parsed?.bucket) return "";
  const common = `--bucket '${parsed.bucket}' --no-sign-request${parsed.region ? ` --region '${parsed.region}'` : ""} --cli-connect-timeout 8 --cli-read-timeout 8 --no-cli-pager`;
  return `aws s3api list-objects-v2 ${common} --max-keys 1\naws s3api get-bucket-acl ${common}`;
}

export function handoffUrls(buckets: IBucket[]): string {
  return [
    ...new Set(
      buckets
        .map((bucket) => {
          const endpoint =
            bucket.endpoint ?? parseS3Url(`https://${bucket.hostname}/`);
          return endpoint?.apiUrl
            ? parseS3Url(endpoint.apiUrl)?.apiUrl
            : undefined;
        })
        .filter(Boolean),
    ),
  ].join("\n");
}
