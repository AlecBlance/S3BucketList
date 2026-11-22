import { IAclPermissions, IBucket } from "@/@types";
import { CheerioAPI } from "cheerio";
import { parseS3Url } from "./endpoints";
import { bucketOperation, regionalEndpoint, scanRequest } from "./scanner";

/**
 * Get all possible information about a bucket
 */
export const getBucketInfo = async (
  bucketName: string,
  apiUrl?: string,
  signal?: AbortSignal,
): Promise<Omit<IBucket, "initiator">> => {
  const endpoint = parseS3Url(apiUrl ?? `https://${bucketName}/`);
  const identity = parseS3Url(`https://${bucketName}/`);
  const root = endpoint?.key === identity?.key ? endpoint?.apiUrl : undefined;
  const at = Date.now();
  if (!root) {
    return {
      date: at,
      hostname: bucketName,
      permissions: {},
      public: false,
      checkStatus: "pending",
      access: {
        listing: { result: "not-checked", at, reason: "unsupported" },
        acl: { result: "not-checked", at, reason: "unsupported" },
      },
    };
  }
  const region = await scanRequest(root, "region", "HEAD", signal);
  const target = regionalEndpoint(endpoint!, region.trace.region) ?? endpoint!;
  const [listResult, aclResult] = await Promise.all([
    bucketOperation(target, "listing", signal),
    bucketOperation(target, "acl", signal),
  ]);
  const listing = listResult.check;
  const acl = aclResult.check;
  const aclPermissions = aclResult.xml ? getACLPermissions(aclResult.xml) : {};
  if (acl.result === "allowed") acl.grants = aclPermissions;

  const owned = listing.result !== "missing" && acl.result !== "missing";

  return {
    // Compatibility only; the UI displays operation-specific evidence instead.
    public: listing.result === "allowed",
    date: Date.now(),
    hostname: bucketName,
    endpoint: listResult.endpoint.region
      ? listResult.endpoint
      : aclResult.endpoint,
    scanTrace: [region.trace, ...listResult.traces, ...aclResult.traces].sort(
      (a, b) => a.at - b.at,
    ),
    owned,
    checkStatus:
      listing.result === "unknown" && acl.result === "unknown"
        ? "failed"
        : "checked",
    access: { listing, acl },
    permissions: {
      ListBucket: listing.result === "allowed",
      ...aclPermissions,
    },
  };
};

/**
 * Check if the bucket contents can be listed
 */
export function hasListBucketPermission(cheerio: CheerioAPI): boolean {
  try {
    const hasListBucket = cheerio("ListBucketResult");
    return hasListBucket.length > 0;
  } catch (error) {
    throw new Error("Failed to fetch list bucket permissions");
  }
}

/**
 * Get public ACL permissions
 */
export function getACLPermissions(cheerio: CheerioAPI): IAclPermissions {
  const acl: IAclPermissions = {
    AllUsers: [],
    AuthenticatedUsers: [],
    LogDelivery: [],
  };
  try {
    const uri = cheerio("*").filter(
      (_, element) =>
        "name" in element &&
        element.name.split(":").at(-1)?.toLowerCase() === "uri",
    );
    uri.toArray().map((elem) => {
      const name = (element: ReturnType<CheerioAPI>): string | undefined => {
        const node = element.get(0);
        return node && "name" in node
          ? node.name.split(":").at(-1)?.toLowerCase()
          : undefined;
      };
      if (
        name(cheerio(elem).parent()) !== "grantee" ||
        name(cheerio(elem).parent().parent()) !== "grant" ||
        name(cheerio(elem).parent().parent().parent()) !== "accesscontrollist"
      )
        return;
      // Get last path segment (e.g. "AllUsers" or "AuthenticatedUsers")
      const value = cheerio(elem).text().trim();
      const groups: Record<string, keyof IAclPermissions> = {
        "http://acs.amazonaws.com/groups/global/AllUsers": "AllUsers",
        "http://acs.amazonaws.com/groups/global/AuthenticatedUsers":
          "AuthenticatedUsers",
        "http://acs.amazonaws.com/groups/s3/LogDelivery": "LogDelivery",
      };
      const title = groups[value];
      // Get Permission attached to that path segment
      const perm = cheerio(elem)
        .parent()
        .nextAll()
        .filter(
          (_, element) =>
            "name" in element &&
            element.name.split(":").at(-1)?.toLowerCase() === "permission",
        )
        .first()
        .text()
        .trim();
      if (
        title &&
        title in acl &&
        ["READ", "WRITE", "READ_ACP", "WRITE_ACP", "FULL_CONTROL"].includes(
          perm,
        )
      ) {
        // acl.AuthenticatedUsers = [...(acl.AuthenticatedUsers || []), perm];
        const key = title as keyof typeof acl;
        acl[key] = [...new Set([...(acl[key] || []), perm])];
      }
    });
    return acl;
  } catch (error) {
    throw new Error("Failed to fetch acl permissions");
  }
}

export function isPublic(aclPermissions: IAclPermissions | undefined): boolean {
  if (!aclPermissions) return false;
  // LogDelivery is an AWS service group, not public access.
  return (
    (aclPermissions.AllUsers?.length ?? 0) > 0 ||
    (aclPermissions.AuthenticatedUsers?.length ?? 0) > 0
  );
}
