export {
  s3Request,
  extensionRequest,
  faviconRequest,
  missingHeaderRequest,
  fakeIBucketInfo,
};

/**
 * Simulates Valid S3 Request
 */
const s3Request: Browser.webRequest.WebResponseHeadersDetails = {
  frameId: 0,
  initiator: "https://sample.s3.amazonaws.com",
  method: "GET",
  parentFrameId: -1,
  requestId: "271",
  responseHeaders: [
    {
      name: "x-amz-request-id",
      value: "3NB8AMWX36134WYC",
    },
    {
      name: "x-amz-id-2",
      value:
        "Du352EmHlApjlrPHnCOISVqJuNCqJR+BMjs/bxQffvuxixaS0a8xpENLG96tnfNKxoGBAO7rDxG0Kn0xdp5rc1/JTlqRQbMGH7p4U0br1NQ=",
    },
    {
      name: "Content-Type",
      value: "application/xml",
    },
    {
      name: "Transfer-Encoding",
      value: "chunked",
    },
    {
      name: "Date",
      value: "Mon, 05 May 2025 14:03:32 GMT",
    },
    {
      name: "Server",
      value: "AmazonS3",
    },
  ],
  statusCode: 404,
  statusLine: "HTTP/1.1 404 Not Found",
  tabId: 265045262,
  timeStamp: 1746453813077.916,
  type: "image",
  url: "https://sample.s3.amazonaws.com",
};

/**
 * Simulates Extension Request (which is not a valid S3 request)
 */
const extensionRequest = {
  ...s3Request,
  tabId: -1,
};

const faviconRequest = {
  ...s3Request,
  url: "https://s3.amazonaws.com/favicon.ico",
};

const missingHeaderRequest = {
  ...s3Request,
  responseHeaders: [
    {
      name: "asdasd",
      value: "3NB8AMWX361",
    },
  ],
};

const fakeIBucketInfo = {
  date: 123123,
  hostname: "example-bucket.s3.amazonaws.com",
  origin: "us-east-1",
  owner: "user123",
  owned: true,
  claimed: true,
  permissions: {
    AllUsers: ["read", "write"],
    AuthenticatedUsers: ["read"],
    ListBucket: true,
  },
  public: false,
  initiator: "admin",
};
