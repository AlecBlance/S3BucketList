import type { IBucket, ICheckSnapshot } from "@/@types";

export const STALE_AFTER = 24 * 60 * 60 * 1000;
export const isStale = (bucket: IBucket, now = Date.now()) =>
  bucket.checkedAt !== undefined && now - bucket.checkedAt > STALE_AFTER;

/** Retain the first result, first access evidence, and the latest checks (50 max). */
export function appendCheck(
  history: ICheckSnapshot[] = [],
  next: ICheckSnapshot,
): ICheckSnapshot[] {
  const all = [...history, next];
  if (all.length <= 50) return all;
  const anchors = [
    all[0],
    all.find((item) => item.listing?.result === "allowed"),
    all.find((item) => item.acl?.result === "allowed"),
    all.find((item) => item.objectHead?.result === "allowed"),
    all.find((item) => item.objectRead?.result === "allowed"),
  ].filter((item): item is ICheckSnapshot => !!item);
  const kept = new Map(anchors.map((item) => [item.id, item]));
  for (const item of all.slice().reverse()) {
    if (kept.size >= 50) break;
    kept.set(item.id, item);
  }
  return all.filter((item) => kept.has(item.id));
}

export function describeChange(
  previous: ICheckSnapshot | undefined,
  current: ICheckSnapshot,
): string {
  if (current.objectRead)
    return `File content: ${current.objectRead.result}. Range requested: bytes=0-0. No content saved.`;
  if (current.objectHead)
    return `File metadata: ${current.objectHead.result}. No file body was downloaded.`;
  if (current.state === "failed")
    return "Check unclear. This does not confirm a fix.";
  if (!previous) return "First saved check.";
  const changes = (["listing", "acl"] as const).flatMap((operation) => {
    const before = previous[operation]?.result;
    const after = current[operation]?.result;
    if (!after || before === after) return [];
    return [
      `${operation === "listing" ? "Listing" : "ACL"}: ${before ?? "not checked"} → ${after}${after === "unknown" ? " (unclear, not a confirmed fix)" : ""}`,
    ];
  });
  return changes.join(" · ") || "No change in these checks.";
}
