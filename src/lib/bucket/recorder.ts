import { isReqBucket, getBucketInfo } from "@/lib/bucket";

/**
 * Handles the checking of the request to see if it is an S3 bucket request
 * and if so, it retrieves the bucketname and permissions
 */
export const bucketRecorder = async (
  request: Browser.webRequest.WebResponseHeadersDetails
) => {
  if (!isReqBucket(request)) return;
  const { hostname, pathname } = new URL(request.url);
  const bucketUrl = cleanBucketUrl(hostname, pathname);
  const bucketInfo = await getBucketInfo(bucketUrl);
  console.log("Bucket name", bucketUrl);
  console.log("Bucket permissions", {
    ...bucketInfo,
    initiator: request.initiator, //where the request came from
  });
};

/**
 * Cleans the url. Making sure it has this format: {bucketName}.s3.amazonaws.com or the original hostname
 * There are instances where the bucket name is a pathname
 */
const cleanBucketUrl = (hostname: string, pathname: string): string => {
  return hostname === "s3.amazonaws.com"
    ? `${hostname}/${pathname.split("/")[1]}`
    : hostname;
};
