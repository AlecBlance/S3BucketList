import type { IBucket, IAccessCheck, IAclPermissions } from "@/@types";
import { safeOrigin } from "./observations";

type Operation = "listing" | "acl" | "object" | "content";
type Confirmed = "allowed" | "denied" | "missing";
const operations: Operation[] = ["listing", "acl", "object", "content"];
const operationCheck = (bucket: IBucket, operation: Operation) =>
  operation === "content"
    ? bucket.objectRead
    : operation === "object"
      ? bucket.objectHead
      : bucket.access?.[operation];
const snapshotCheck = (
  item: NonNullable<IBucket["checkHistory"]>[number],
  operation: Operation,
) =>
  operation === "content"
    ? item.objectRead
    : operation === "object"
      ? item.objectHead
      : item[operation];
const confirmed = (
  check?: IAccessCheck,
): check is IAccessCheck & { result: Confirmed } =>
  !!check && ["allowed", "denied", "missing"].includes(check.result);

/** An inconclusive retest must not erase previously confirmed access. */
export function confirmedAccess(
  bucket: IBucket,
): NonNullable<IBucket["reviewBaseline"]> {
  const result: NonNullable<IBucket["reviewBaseline"]> = {};
  for (const operation of operations) {
    if (
      (operation === "object" || operation === "content") &&
      (operationCheck(bucket, operation)?.result === "allowed" ||
        bucket.checkHistory?.some(
          (item) => snapshotCheck(item, operation)?.result === "allowed",
        ))
    ) {
      // Object paths are not retained, so later tests may target different files.
      // A denial cannot retract an earlier positive result for another file.
      result[operation] = "allowed";
      continue;
    }
    const latest = operationCheck(bucket, operation);
    if (confirmed(latest)) result[operation] = latest.result;
    else {
      const previous = bucket.checkHistory
        ?.slice()
        .reverse()
        .map((item) => snapshotCheck(item, operation))
        .find(confirmed);
      if (confirmed(previous)) result[operation] = previous.result;
    }
  }
  return result;
}

/** Called in the serialized storage update so notes and dismissals cannot race a check. */
export function reconcileReview(previous: IBucket, next: IBucket): IBucket {
  if (previous.reviewStatus !== "expected") return next;
  const baseline = previous.reviewBaseline ?? confirmedAccess(previous);
  const changed = operations.some((operation) => {
    const check = operationCheck(next, operation);
    if (operation === "object" || operation === "content")
      return check?.result === "allowed" && baseline[operation] !== "allowed";
    return (
      confirmed(check) &&
      (baseline[operation] !== undefined
        ? check.result !== baseline[operation]
        : check.result === "allowed")
    );
  });
  const grantsBefore =
    previous.reviewGrantBaseline ?? captureReviewGrants(previous);
  const grantsAfter =
    next.access?.acl?.result === "allowed" && next.access.acl.grants
      ? next.access.acl.grants
      : undefined;
  const expanded = (values: string[] = []) =>
    new Set(
      values.includes("FULL_CONTROL")
        ? ["READ", "WRITE", "READ_ACP", "WRITE_ACP", "FULL_CONTROL"]
        : values,
    );
  const grantAdded =
    grantsAfter &&
    (["AllUsers", "AuthenticatedUsers"] as const).some((group) =>
      [...expanded(grantsAfter[group])].some(
        (permission) => !expanded(grantsBefore[group]).has(permission),
      ),
    );
  return changed || grantAdded
    ? {
        ...next,
        reviewStatus: "todo",
        reviewBaseline: undefined,
        reviewGrantBaseline: undefined,
      }
    : next;
}

export function newlyAllowed(bucket: IBucket): Operation[] {
  return operations.filter((operation) => {
    if (operation === "object" || operation === "content") return false; // No stored key with which to compare file tests.
    const checks = (bucket.checkHistory ?? [])
      .slice()
      .reverse()
      .map((item) => item[operation])
      .filter(confirmed);
    return (
      checks[0]?.result === "allowed" &&
      checks[1]?.result === "denied" &&
      !!checks[0].endpoint &&
      checks[0].endpoint === checks[1].endpoint
    );
  });
}

export function needsReview(bucket: IBucket): boolean {
  if (bucket.endpoint?.kind === "custom" || bucket.reviewStatus === "expected")
    return false;
  if (isMissingLead(bucket)) return false;
  const access = confirmedAccess(bucket);
  return (
    access.listing === "allowed" ||
    access.acl === "allowed" ||
    access.object === "allowed" ||
    access.content === "allowed"
  );
}

export function isMissingLead(bucket: IBucket): boolean {
  if (bucket.endpoint?.kind === "custom") return false;
  const missingAt = Math.max(
    bucket.access?.listing?.result === "missing" ? bucket.access.listing.at : 0,
    bucket.access?.acl?.result === "missing" ? bucket.access.acl.at : 0,
  );
  if (
    bucket.objectRead?.result === "allowed" &&
    bucket.objectRead.at > missingAt
  )
    return false;
  if (
    bucket.objectHead?.result === "allowed" &&
    bucket.objectHead.at > missingAt
  )
    return false;
  const current = [bucket.access?.listing?.result, bucket.access?.acl?.result];
  if (current.includes("missing") && !current.includes("allowed")) return true;
  const access = confirmedAccess(bucket);
  return (
    ((access.listing === "missing" || access.acl === "missing") &&
      access.listing !== "allowed" &&
      access.acl !== "allowed") ||
    (!bucket.access && !bucket.checkStatus && bucket.owned === false)
  );
}

export function reviewReason(bucket: IBucket): string {
  if (bucket.reviewStatus === "expected") return "Marked expected";
  if (bucket.endpoint?.kind === "custom") return "Origin bucket unknown";
  if (isMissingLead(bucket)) return "Bucket not found";
  const access = confirmedAccess(bucket);
  const changed = newlyAllowed(bucket);
  if (access.content === "allowed") return "File content readable";
  if (access.object === "allowed") return "File metadata readable";
  if (publicAclWarnings(bucket).length)
    return "ACL reports public write access";
  if (changed.includes("listing") && access.listing === "allowed")
    return "Listing now allowed";
  if (changed.includes("acl") && access.acl === "allowed")
    return "ACL now readable";
  if (access.listing === "allowed") return "Listing request allowed";
  if (access.acl === "allowed") return "Access rules readable";
  if (bucket.checkStatus === "checking") return "Checking…";
  if (bucket.checkStatus === "failed") return "Check unclear";
  if (bucket.discovery === "reference" && !bucket.checkedAt)
    return "Page reference · not checked";
  if (!bucket.access?.listing && !bucket.access?.acl) return "Not checked";
  if (
    bucket.access?.listing?.result === "unknown" ||
    bucket.access?.acl?.result === "unknown"
  )
    return "Check unclear";
  if (bucket.access?.file) return "File seen in browser";
  if (bucket.access?.signedLink) return "Signed link seen";
  return bucket.access?.listing?.result === "denied" &&
    bucket.access?.acl?.result === "denied"
    ? "Listing and access rules denied"
    : "Not checked";
}

export function reviewSummary(bucket: IBucket): string {
  if (bucket.endpoint?.kind === "custom")
    return "S3 signs were seen at this address, but its origin bucket is unknown. A custom domain, CDN, or unsupported S3 address can cause this. Bucket API checks are unavailable.";
  if (isMissingLead(bucket))
    return "S3 reported that the bucket was not found. That does not mean its name is available.";
  const access = confirmedAccess(bucket);
  const statements: string[] = [];
  if (access.content === "allowed")
    statements.push(
      "An unsigned range request returned one byte of a file. The byte and file path were not saved.",
    );
  if (access.object === "allowed")
    statements.push(
      "A file's metadata was readable without credentials. The file body was not downloaded.",
    );
  if (access.listing === "allowed")
    statements.push("An unsigned request could list files in this bucket.");
  if (access.acl === "allowed")
    statements.push(
      "An unsigned request could read the bucket's access control list (ACL).",
    );
  if (statements.length) {
    if (
      bucket.checkStatus === "failed" ||
      operations.some(
        (operation) =>
          access[operation] === "allowed" &&
          operationCheck(bucket, operation)?.result === "unknown",
      )
    )
      statements.push(
        "The latest check was unclear; this is earlier confirmed evidence, not a confirmed fix.",
      );
    statements.push("No write tests were performed.");
  } else if (isMissingLead(bucket))
    statements.push(
      "A bucket check reported a missing bucket. This is a lead to investigate, not proof of takeover or an available name.",
    );
  else if (bucket.discovery === "reference" && !bucket.checkedAt)
    statements.push(
      "This address was found in a page. Extraction did not fetch it. Run a check if it is within your scope.",
    );
  else
    statements.push(
      "No anonymous listing or readable ACL has been confirmed. That does not prove files are private; a browser file response or signed link is not an anonymous-access test.",
    );
  return statements.join(" ");
}

export function reviewHelpKey(bucket: IBucket): string {
  const reason = reviewReason(bucket);
  if (reason === "Origin bucket unknown") return "Bucket unknown";
  if (reason === "File content readable") return "File content readable";
  if (reason === "File metadata readable") return "File metadata readable";
  if (reason === "ACL reports public write access")
    return "ACL reports public write access";
  if (reason.includes("Listing now") || reason === "Listing request allowed")
    return "Can list";
  if (reason.includes("ACL now") || reason === "Access rules readable")
    return "ACL readable";
  if (reason === "File seen in browser") return "File seen";
  if (reason === "Check unclear") return "Check failed";
  if (reason === "Listing and access rules denied")
    return "No anonymous listing or ACL access found";
  if (reason === "Page reference · not checked") return "Not checked";
  return reason;
}

export function reportedAcl(bucket: IBucket) {
  if (confirmedAccess(bucket).acl !== "allowed") return {};
  return (
    bucket.access?.acl?.grants ??
    bucket.checkHistory
      ?.slice()
      .reverse()
      .find((item) => item.acl?.result === "allowed")?.acl?.grants ??
    bucket.permissions
  );
}
export function captureReviewGrants(bucket: IBucket): IAclPermissions {
  const grants = reportedAcl(bucket);
  return Object.fromEntries(
    (["AllUsers", "AuthenticatedUsers"] as const).map((group) => [
      group,
      [
        ...new Set(
          (grants[group] ?? [])
            .map((value) => value.toUpperCase())
            .filter((value) =>
              [
                "READ",
                "WRITE",
                "READ_ACP",
                "WRITE_ACP",
                "FULL_CONTROL",
              ].includes(value),
            ),
        ),
      ],
    ]),
  );
}
export function publicAclWarnings(bucket: IBucket): string[] {
  return (reportedAcl(bucket).AllUsers ?? []).filter((permission) =>
    ["WRITE", "WRITE_ACP", "FULL_CONTROL"].includes(permission),
  );
}

export function referringSite(bucket: IBucket): string {
  return (
    safeOrigin(bucket.observations?.sources.at(-1) ?? bucket.initiator ?? "") ??
    (bucket.discovery === "manual" ? "Added manually" : "Site not available")
  );
}

export function sortForReview(buckets: IBucket[]): IBucket[] {
  const priority = (bucket: IBucket) =>
    !needsReview(bucket)
      ? 0
      : confirmedAccess(bucket).content === "allowed" ||
          confirmedAccess(bucket).object === "allowed" ||
          publicAclWarnings(bucket).length
        ? 4
        : newlyAllowed(bucket).length
          ? 3
          : confirmedAccess(bucket).listing === "allowed"
            ? 2
            : 1;
  return buckets
    .slice()
    .sort(
      (a, b) =>
        priority(b) - priority(a) ||
        (b.checkedAt ?? b.date) - (a.checkedAt ?? a.date),
    );
}
