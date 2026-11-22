import { describe, expect, it } from "vitest";
import { permissionTone, statusTone } from "./status-tone";

describe("evidence status colors", () => {
  it.each([
    ["File content readable", "allowed"],
    ["File metadata readable", "allowed"],
    ["ACL reports public write access", "risk"],
    ["Can list", "allowed"],
    ["Listing request allowed", "allowed"],
    ["ACL readable", "allowed"],
    ["Bucket not found", "review"],
    ["Bucket unknown", "identity"],
    ["Origin bucket unknown", "identity"],
    ["Check failed", "review"],
    ["Listing blocked", "denied"],
    ["ACL blocked", "denied"],
    ["Checking…", "active"],
    ["Queued", "active"],
    ["Marked expected", "neutral"],
    ["Not checked", "neutral"],
    ["Checked", "neutral"],
    ["done", "neutral"],
    ["Signed link seen", "neutral"],
  ])("%s uses %s without implying an overall safety verdict", (label, tone) => {
    expect(statusTone(label)).toBe(tone);
  });
  it("matches permission-table evidence to discovery colors", () => {
    expect(permissionTone("allowed", "content")).toBe("allowed");
    expect(permissionTone("allowed", "object")).toBe("allowed");
    expect(permissionTone("allowed", "listing")).toBe("allowed");
    expect(permissionTone("allowed", "acl")).toBe("allowed");
    expect(permissionTone("denied", "listing")).toBe("denied");
    expect(permissionTone("unknown", "content")).toBe("review");
    expect(permissionTone("missing", "content")).toBe("review");
    expect(permissionTone("not-checked", "content")).toBe("neutral");
    expect(permissionTone(undefined, "content")).toBe("neutral");
  });
});
