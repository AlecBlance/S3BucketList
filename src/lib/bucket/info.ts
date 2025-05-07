import axios from "axios";
import { IBucket, IPermissions } from "@/@types";
import { CheerioAPI, load } from "cheerio";

/**
 * Get all possible information about a bucket
 * ! This needs to be refactored for better readability
 */
export const getBucketInfo = async (
  bucketName: string
): Promise<Omit<IBucket, "initiator">> => {
  const [listBucketReq, aclReq] = await Promise.allSettled([
    hasListBucketPermission(bucketName),
    axios.get(`https://${bucketName}/?acl`),
  ]);
  const listBucket =
    listBucketReq.status === "fulfilled" ? listBucketReq.value : {};
  const acl = aclReq.status === "fulfilled" ? aclReq.value : undefined;

  const $ = acl ? load(acl.data) : undefined;
  const owned = aclReq.status !== "rejected" || aclReq.reason.status !== 404;
  const aclPermissions = $ ? getACLPermissions($) : undefined;
  const permissions: IPermissions = {
    ...listBucket,
    ...aclPermissions,
  };

  return {
    public:
      !!aclPermissions?.AllUsers?.length ||
      !!aclPermissions?.AuthenticatedUsers?.length ||
      !!listBucket?.ListBucket ||
      !owned,
    date: Date.now(),
    hostname: bucketName,
    owner: $?.("Owner")?.text(),
    owned,
    permissions,
  };
};

/**
 * Check if the bucket contents can be listed
 */
export async function hasListBucketPermission(
  bucketName: string
): Promise<{ ListBucket?: boolean }> {
  const url = `https://${bucketName}`;
  try {
    const response = await axios.get(url);
    const $ = load(response.data);
    const hasListBucket = $("ListBucketResult");
    return hasListBucket.length > 0 ? { ListBucket: true } : {};
  } catch (error) {
    throw new Error("Failed to fetch list bucket permissions");
  }
}

/**
 * Get public ACL permissions
 */
export function getACLPermissions(
  $: CheerioAPI
): Omit<IPermissions, "ListBucket"> {
  const acl: Omit<IPermissions, "ListBucket"> = {
    AllUsers: [],
    AuthenticatedUsers: [],
  };
  try {
    const hasUri = $("URI");
    hasUri.toArray().map((elem) => {
      // Get last path segment (e.g. "AllUsers" or "AuthenticatedUsers")
      const title = $(elem).text().split("/").pop()!;
      // Get Permission attached to that path segment
      const perm = $(elem).parent().next().text();
      switch (title) {
        case "AllUsers":
          acl.AllUsers = [...(acl.AllUsers || []), perm];
          break;
        case "AuthenticatedUsers":
          acl.AuthenticatedUsers = [...(acl.AuthenticatedUsers || []), perm];
          break;
      }
    });
    return acl;
  } catch (error) {
    throw new Error("Failed to fetch acl permissions");
  }
}
