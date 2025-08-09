import axios from "axios";
import { IAclPermissions, IBucket, IPermissions } from "@/@types";
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
  let ListBucket = false;

  if (isAclAvailable) {
    const cheerio: CheerioAPI = load(getBucketAcl.value.data);
    aclPermissions = getACLPermissions(cheerio);
    owner = cheerio("Owner").text();
  }

  if (isBucketAvailable) {
    const cheerio: CheerioAPI = load(getBucket.value.data);
    ListBucket = hasListBucketPermission(cheerio);
  }

  const owned = !(
    getBucket.status === "rejected" &&
    getBucket.reason.response.status === 404 &&
    load(getBucket.reason.response.data)("Code").text() === "NoSuchBucket"
  );

  return {
    public: ListBucket || isPublic(aclPermissions) || !owned,
    date: Date.now(),
    hostname: bucketName,
    owner,
    owned,
    permissions: {
      ListBucket,
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

export function isPublic(aclPermissions: IAclPermissions | undefined): boolean {
  if (!aclPermissions) return false;
  return Object.values(aclPermissions).some((value) => value.length > 0);
}
