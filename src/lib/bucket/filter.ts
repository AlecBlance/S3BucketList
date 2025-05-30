import { logger } from "../logger";

/**
 * Checks if the request is an S3 bucket request
 */
export const isReqBucket = (
  request: Browser.webRequest.WebResponseHeadersDetails,
): boolean => {
  logger("Checking request", request.url);
  return (
    !isExtensionRequest(request) &&
    !hasFavicon(request) &&
    hasAmazonHeader(request)
  );
};

/**
 * Filters out favicon requests
 */
export function hasFavicon(
  request: Browser.webRequest.WebResponseHeadersDetails,
): boolean {
  const { hostname, pathname } = new URL(request.url);
  const hasFavicon =
    hostname === "s3.amazonaws.com" && pathname.startsWith("/favicon.ico");
  logger("- Does it have favicon", hasFavicon);
  return hasFavicon;
}

/**
 * This is a workaround to filter out S3BucketList requests that tries to extract the s3 bucket's permissions
 * ? Can we add a query parameter to the request to identify it instead?
 */
export function isExtensionRequest(
  request: Browser.webRequest.WebResponseHeadersDetails,
): boolean {
  const extensionUrls = ["chrome-extension://", "moz-extension://"];
  const isExtensionRequest =
    extensionUrls.some((url) => request.url?.includes(url)) ||
    request.tabId === -1;
  logger("- Is it coming from extension", isExtensionRequest);
  return isExtensionRequest;
}

/**
 * Checks if the request header has amazon headers
 */
export function hasAmazonHeader(
  request: Browser.webRequest.WebResponseHeadersDetails,
): boolean {
  const amazonHeaders = [
    "x-amz-request-id",
    "x-amz-id-2",
    "x-amz-bucket-region",
  ];
  const hasAmazonHeader = Boolean(
    request.responseHeaders?.some((header) => {
      const lowerCaseHeader = header.name.toLowerCase();
      const isAmazonServer =
        lowerCaseHeader === "server" &&
        header.value?.toLowerCase() === "amazons3";
      return amazonHeaders.includes(lowerCaseHeader) || isAmazonServer;
    }),
  );
  logger("- Has amazon header?", hasAmazonHeader);

  return hasAmazonHeader;
}
