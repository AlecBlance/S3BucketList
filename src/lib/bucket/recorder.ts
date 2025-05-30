import { IBucket } from "@/@types";
import { isReqBucket, getBucketInfo } from "@/lib/bucket";
import { bucketsStorage } from "@/lib/storage";
import { logger } from "../logger";

/**
 * Handles the checking of the request to see if it is an S3 bucket request
 * and if so, it retrieves the bucketname and permissions
 */
export const bucketRecorder = async (
  request: Browser.webRequest.WebResponseHeadersDetails,
) => {
  if (!isReqBucket(request)) return;
  const { hostname, pathname } = new URL(request.url);
  const bucketUrl = cleanBucketUrl(hostname, pathname);
  const bucketInfo = await getBucketInfo(bucketUrl);
  addToBucketStorage({
    ...bucketInfo,
    initiator: request.initiator, //where the request came from
  });
};

/**
 * Cleans the url. Making sure it has this format: {bucketName}.s3.amazonaws.com or the original hostname
 * There are instances where the bucket name is a pathname
 */
export const cleanBucketUrl = (hostname: string, pathname: string): string => {
  return hostname === "s3.amazonaws.com"
    ? `${pathname.split("/")[1]}.${hostname}`
    : hostname;
};

/**
 * Adds bucket information to the storage
 */
export const addToBucketStorage = async (
  bucketInfo: IBucket,
): Promise<void> => {
  const bucketsList = await bucketsStorage.getValue();
  const isRecorded = bucketsList.some(
    (bucket) => bucket.hostname === bucketInfo.hostname,
  );
  if (isRecorded) return;

  bucketsList.push(bucketInfo);
  bucketsStorage.setValue(bucketsList);
  logger("Bucket added to storage", bucketInfo);
};
