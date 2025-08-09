import axios from "axios";
import { IBucket, IPermissions } from "@/@types";
import { Agent } from "https";
import { CheerioAPI, load } from "cheerio";

const axiosInstance = axios.create({
  httpsAgent: new Agent({ rejectUnauthorized: false }),
});

/**
 * Get all possible information about a bucket
 */
export const getBucketInfo = async (
  bucketName: string,
): Promise<Omit<IBucket, "initiator">> => {
  const [getBucket, getBucketAcl] = await Promise.allSettled([
    axiosInstance.get<string>(`https://${bucketName}/`),
    axiosInstance.get<string>(`https://${bucketName}/?acl`),
  ]);
  const isAclAvailable = getBucketAcl.status === "fulfilled";
  const isBucketAvailable = getBucket.status === "fulfilled";

  let owner: string | undefined = undefined;
  let aclPermissions: Omit<IPermissions, "ListBucket"> = {};

  if (isAclAvailable) {
    const cheerio: CheerioAPI = load(getBucketAcl.value.data);
    aclPermissions = getACLPermissions(cheerio);
    owner = cheerio("Owner").text();
  }

  const ListBucket = isBucketAvailable
    ? hasListBucketPermission(getBucket.value.data)
    : false;

  // TODO: [ISSUE#32] Re-enable bucket ownership detection after resolving related issues.
  // The issue is that some buckets return 404 for ACL requests, even if they are owned.
  // const owned = aclReq.status !== "rejected" || aclReq.reason.status !== 404;

  return {
    public: ListBucket || isPublic(aclPermissions),
    // TODO: [ISSUE#32] Re-enable bucket ownership detection after resolving related issues
    // !owned,
    date: Date.now(),
    hostname: bucketName,
    owner,
    // TODO: [ISSUE#32] Re-enable bucket ownership detection after resolving related issues
    // owned,
    permissions: {
      ListBucket,
      ...aclPermissions,
    },
  };
};

/**
 * Check if the bucket contents can be listed
 */
export function hasListBucketPermission(bucketData: string): boolean {
  try {
    const $ = load(bucketData);
    const hasListBucket = $("ListBucketResult");
    return hasListBucket.length > 0;
  } catch (error) {
    throw new Error("Failed to fetch list bucket permissions");
  }
}

/**
 * Get public ACL permissions
 */
export function getACLPermissions(
  cheerio: CheerioAPI,
): Omit<IPermissions, "ListBucket"> {
  const acl: Omit<IPermissions, "ListBucket"> = {
    AllUsers: [],
    AuthenticatedUsers: [],
    LogDelivery: [],
  };
  try {
    const uri = cheerio("URI");
    uri.toArray().map((elem) => {
      // Get last path segment (e.g. "AllUsers" or "AuthenticatedUsers")
      const title = cheerio(elem).text().split("/").pop()!;
      // Get Permission attached to that path segment
      const perm = cheerio(elem).parent().next().text();
      if (title in acl) {
        // acl.AuthenticatedUsers = [...(acl.AuthenticatedUsers || []), perm];
        const key = title as keyof typeof acl;
        acl[key] = [...(acl[key] || []), perm];
      }
    });
    return acl;
  } catch (error) {
    throw new Error("Failed to fetch acl permissions");
  }
}

export function isPublic(
  aclPermissions: Omit<IPermissions, "ListBucket"> | undefined,
): boolean {
  if (!aclPermissions) return false;
  return Object.values(aclPermissions).some((value) => value.length > 0);
}
