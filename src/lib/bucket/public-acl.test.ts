import { describe, expect, it } from "vitest";
import { isPublic, getACLPermissions } from "./info";
import { load } from "cheerio";

describe("public ACL classification", () => {
  it("does not classify log delivery grants as public", () => {
    const acl = getACLPermissions(
      load(`
      <AccessControlPolicy><AccessControlList><Grant>
        <Grantee><URI>http://acs.amazonaws.com/groups/s3/LogDelivery</URI></Grantee>
        <Permission>WRITE</Permission>
      </Grant></AccessControlList></AccessControlPolicy>
    `),
    );
    expect(acl.LogDelivery).toEqual(["WRITE"]);
    expect(isPublic(acl)).toBe(false);
  });

  it("recognizes anonymous access", () => {
    expect(isPublic({ AllUsers: ["READ"] })).toBe(true);
  });

  it("recognizes access available to any authenticated AWS user", () => {
    expect(isPublic({ AuthenticatedUsers: ["READ"] })).toBe(true);
  });

  it("handles absent and partial permissions", () => {
    expect(isPublic(undefined)).toBe(false);
    expect(isPublic({})).toBe(false);
    expect(isPublic({ AllUsers: undefined, LogDelivery: ["WRITE"] })).toBe(
      false,
    );
  });
});
