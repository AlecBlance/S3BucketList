import type { IAccessCheck } from "@/@types";

export type StatusTone =
  | "allowed"
  | "risk"
  | "identity"
  | "review"
  | "denied"
  | "active"
  | "neutral";

/** Colors describe evidence, never an overall secure/vulnerable verdict. */
export function statusTone(label: string): StatusTone {
  if (label === "ACL reports public write access") return "risk";
  if (
    [
      "File content readable",
      "File metadata readable",
      "Can list",
      "ACL readable",
      "Listing request allowed",
      "Access rules readable",
    ].includes(label)
  )
    return "allowed";
  if (
    [
      "Bucket not found",
      "Listing unclear",
      "ACL unclear",
      "Check failed",
      "Outdated · over 24h",
      "failed",
    ].includes(label)
  )
    return "review";
  if (["Bucket unknown", "Origin bucket unknown"].includes(label))
    return "identity";
  if (
    [
      "Listing blocked",
      "ACL blocked",
      "No anonymous listing or ACL access found",
    ].includes(label)
  )
    return "denied";
  if (["Checking", "Checking…", "Queued", "queued", "running"].includes(label))
    return "active";
  return "neutral";
}

export function permissionTone(
  result: IAccessCheck["result"] | undefined,
  operation: string,
): StatusTone {
  if (result === "allowed")
    return ["listing", "acl", "object", "content"].includes(operation)
      ? "allowed"
      : "neutral";
  if (result === "denied") return "denied";
  if (result === "missing" || result === "unknown") return "review";
  return "neutral";
}
