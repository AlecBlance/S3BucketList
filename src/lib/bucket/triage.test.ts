import { describe, expect, it } from "vitest";
import type { IBucket, IAccessCheck, ICheckSnapshot } from "@/@types";
import { fakeIBucketInfo } from "@/_test/index.config";
import {
  confirmedAccess,
  needsReview,
  isMissingLead,
  reconcileReview,
  newlyAllowed,
  sortForReview,
  reviewReason,
  reviewSummary,
} from "./triage";
const check = (result: IAccessCheck["result"], at = 1): IAccessCheck => ({
  result,
  at,
});
const snapshot = (
  result: IAccessCheck["result"],
  at: number,
): ICheckSnapshot => ({
  id: String(at),
  at,
  state: "checked",
  listing: {
    ...check(result, at),
    endpoint: "https://s3.amazonaws.com/sample/?list-type=2&max-keys=1",
  },
});
const bucket = (
  listing: IAccessCheck["result"],
  acl: IAccessCheck["result"] = "denied",
): IBucket => ({
  ...fakeIBucketInfo,
  hostname: "sample.s3.amazonaws.com",
  access: { listing: check(listing), acl: check(acl) },
});

describe("attention triage", () => {
  it("only promotes confirmed anonymous listing or readable ACL evidence", () => {
    expect(needsReview(bucket("allowed"))).toBe(true);
    expect(needsReview(bucket("denied", "allowed"))).toBe(true);
    for (const result of [
      "denied",
      "missing",
      "unknown",
      "not-checked",
    ] as const)
      expect(needsReview(bucket(result))).toBe(false);
    expect(
      needsReview({
        ...bucket("denied"),
        access: {
          file: { at: 1, status: 200, context: "browser" },
          signedLink: true,
        },
      }),
    ).toBe(false);
    expect(
      needsReview({
        ...bucket("allowed"),
        endpoint: {
          key: "custom:x",
          hostname: "cdn.example",
          kind: "custom",
          object: false,
        },
      }),
    ).toBe(false);
    expect(
      needsReview({ ...fakeIBucketInfo, public: true, access: undefined }),
    ).toBe(false);
  });
  it("keeps missing buckets separate from review and takeover conclusions", () => {
    const lead = {
      ...bucket("missing", "unknown"),
      checkHistory: [snapshot("allowed", 1)],
    };
    expect(isMissingLead(lead)).toBe(true);
    expect(needsReview(lead)).toBe(false);
    expect(reviewReason(lead)).toBe("Bucket not found");
    expect(reviewSummary(lead)).toContain("does not mean its name is available");
  });
  it("does not erase evidence on failed retests or resurrect access after a conclusive denial", () => {
    const uncertain = {
      ...bucket("unknown"),
      checkStatus: "failed" as const,
      checkHistory: [snapshot("allowed", 1), snapshot("unknown", 2)],
    };
    expect(confirmedAccess(uncertain).listing).toBe("allowed");
    expect(needsReview(uncertain)).toBe(true);
    expect(reviewSummary(uncertain)).toContain("earlier confirmed evidence");
    expect(
      needsReview({
        ...uncertain,
        checkHistory: [
          snapshot("allowed", 1),
          snapshot("denied", 2),
          snapshot("unknown", 3),
        ],
      }),
    ).toBe(false);
  });
  it("keeps expected discoveries dismissed on repeat sightings, matching results, and inconclusive checks", () => {
    const original: IBucket = {
      ...bucket("allowed"),
      reviewStatus: "expected",
      reviewBaseline: { listing: "allowed", acl: "denied" },
    };
    expect(needsReview(original)).toBe(false);
    expect(
      reconcileReview(original, { ...original, date: 100 }).reviewStatus,
    ).toBe("expected");
    expect(
      reconcileReview(original, {
        ...original,
        access: { listing: check("allowed", 5), acl: check("denied", 5) },
      }).reviewStatus,
    ).toBe("expected");
    expect(
      reconcileReview(original, {
        ...original,
        access: { listing: check("unknown", 5), acl: check("unknown", 5) },
      }).reviewStatus,
    ).toBe("expected");
    const incomplete: IBucket = {
      ...original,
      reviewBaseline: { listing: "allowed" },
    };
    expect(
      reconcileReview(incomplete, {
        ...incomplete,
        access: { listing: check("allowed"), acl: check("denied") },
      }).reviewStatus,
    ).toBe("expected");
  });
  it("reopens expected findings only on a newly confirmed result change", () => {
    const original: IBucket = {
      ...bucket("allowed"),
      reviewStatus: "expected",
      reviewBaseline: { listing: "allowed", acl: "denied" },
      notes: "Keep my notes",
    };
    const reopened = reconcileReview(original, {
      ...original,
      access: { listing: check("allowed", 2), acl: check("allowed", 2) },
    });
    expect(reopened.reviewStatus).toBe("todo");
    expect(needsReview(reopened)).toBe(true);
    expect(reopened.notes).toBe("Keep my notes");
    expect(reopened.reviewBaseline).toBeUndefined();
    const legacy = { ...original, reviewBaseline: undefined };
    expect(
      reconcileReview(legacy, {
        ...legacy,
        access: { listing: check("allowed"), acl: check("allowed") },
      }).reviewStatus,
    ).toBe("todo");
  });
  it("prioritizes newly opened access, then listings, then ACL-only evidence", () => {
    const listing = { ...bucket("allowed"), hostname: "listing" };
    const acl = { ...bucket("denied", "allowed"), hostname: "acl", date: 100 };
    const change = {
      ...bucket("allowed"),
      hostname: "changed",
      checkHistory: [snapshot("denied", 1), snapshot("allowed", 2)],
    };
    expect(newlyAllowed(change)).toEqual(["listing"]);
    expect(reviewReason(change)).toBe("Listing now allowed");
    expect(
      sortForReview([acl, listing, change]).map((item) => item.hostname),
    ).toEqual(["changed", "listing", "acl"]);
  });
  it("promotes verified file metadata, but does not mistake a later file denial for a fix", () => {
    const positive = { ...bucket("denied"), objectHead: check("allowed", 3) };
    expect(needsReview(positive)).toBe(true);
    expect(reviewReason(positive)).toBe("File metadata readable");
    const later = {
      ...positive,
      objectHead: check("denied", 5),
      checkHistory: [
        {
          id: "file",
          at: 3,
          state: "checked" as const,
          objectHead: check("allowed", 3),
        },
      ],
    };
    expect(needsReview(later)).toBe(true); // Keys are not saved; these may be different files.
    expect(newlyAllowed(later)).not.toContain("object");
  });
  it("does not call a different listing request a newly opened permission", () => {
    const old = snapshot("denied", 1);
    old.listing!.endpoint = "https://s3.amazonaws.com/sample/";
    const current = {
      ...bucket("allowed"),
      checkHistory: [old, snapshot("allowed", 2)],
    };
    expect(newlyAllowed(current)).toEqual([]);
    expect(reviewReason(current)).toBe("Listing request allowed");
  });
  it("prioritizes reported public write grants without claiming writes were exercised", () => {
    const grant = {
      ...bucket("denied", "allowed"),
      access: {
        listing: check("denied"),
        acl: { ...check("allowed"), grants: { AllUsers: ["WRITE_ACP"] } },
      },
    };
    expect(reviewReason(grant)).toBe("ACL reports public write access");
    expect(sortForReview([bucket("allowed"), grant])[0]).toBe(grant);
  });
  it("reopens expected discoveries when the readable ACL adds a broad grant", () => {
    const before: IBucket = {
      ...bucket("allowed", "allowed"),
      reviewStatus: "expected",
      reviewBaseline: { listing: "allowed", acl: "allowed" },
      reviewGrantBaseline: { AllUsers: ["READ"] },
    };
    const next = {
      ...before,
      access: {
        listing: check("allowed"),
        acl: {
          ...check("allowed"),
          grants: { AllUsers: ["READ", "WRITE_ACP"] },
        },
      },
    };
    expect(reconcileReview(before, next).reviewStatus).toBe("todo");
    expect(
      reconcileReview(
        { ...before, reviewGrantBaseline: { AllUsers: ["FULL_CONTROL"] } },
        next,
      ).reviewStatus,
    ).toBe("expected");
  });
});
