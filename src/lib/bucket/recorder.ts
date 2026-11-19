import { IBucket } from "@/@types";
import { isReqBucket, getBucketInfo } from "@/lib/bucket";
import { bucketsStorage } from "@/lib/storage";
import { addBadgeNumber } from "./badge";

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
  await addToBucketStorage({
    ...bucketInfo,
    initiator: request.initiator, //where the request came from
  });
};

/**
 * Cleans the url. Making sure it has this format: {bucketName}.s3.amazonaws.com or the original hostname
 * There are instances where the bucket name is a pathname
 */
export function cleanBucketUrl(hostname: string, pathname: string): string {
  const isRegionalEndpoint = /^s3[.-][a-z0-9-]+\.amazonaws\.com$/.test(
    hostname,
  );

  if (
    (hostname === "s3.amazonaws.com" || isRegionalEndpoint) &&
    pathname !== "/"
  ) {
    const bucket = pathname.split("/")[1];
    if (bucket) {
      return `${bucket}.s3.amazonaws.com`;
    }
  }

  return hostname;
}
// All mutations run in the background, including popup deletion requests.
let storageQueue: Promise<unknown> = Promise.resolve();

const updateBucketStorage = (
  update: (buckets: IBucket[]) => IBucket[],
): Promise<IBucket[]> => {
  const operation = storageQueue.then(async () => {
    const buckets = update(await bucketsStorage.getValue());
    await bucketsStorage.setValue(buckets);
    await addBadgeNumber(buckets);
    return buckets;
  });
  storageQueue = operation.catch(() => undefined);
  return operation;
};

export const addToBucketStorage = async (
  bucketInfo: IBucket,
): Promise<void> => {
  await updateBucketStorage((buckets) => {
    if (buckets.some((bucket) => bucket.hostname === bucketInfo.hostname))
      return buckets;
    return [...buckets, bucketInfo];
  });
};

export const removeFromBucketStorage = (
  hostnames: string[],
): Promise<IBucket[]> =>
  updateBucketStorage((buckets) =>
    buckets.filter((bucket) => !hostnames.includes(bucket.hostname)),
  );
