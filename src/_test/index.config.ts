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

export const fakeBucketData = `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>aneta</Name><Prefix/><Marker/><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated><Contents><Key>css/animations.css</Key><LastModified>2017-05-02T13:28:47.000Z</LastModified><ETag>"efa908b9da5810ec2b3e2f5665b26b22"</ETag><Size>88967</Size><StorageClass>STANDARD</StorageClass></Contents></ListBucketResult>`;
export const fakeAclData = `<AccessControlPolicy xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Owner><ID>c7f6e5706fc415058cb9f4d41107a24191a94f1b79dbce9cd9a516925d718c1d</ID></Owner><AccessControlList><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser"><ID>c7f6e5706fc415058cb9f4d41107a24191a94f1b79dbce9cd9a516925d718c1d</ID></Grantee><Permission>FULL_CONTROL</Permission></Grant><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Group"><URI>http://acs.amazonaws.com/groups/global/AuthenticatedUsers</URI></Grantee><Permission>READ</Permission></Grant><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Group"><URI>http://acs.amazonaws.com/groups/global/AuthenticatedUsers</URI></Grantee><Permission>READ_ACP</Permission></Grant><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Group"><URI>http://acs.amazonaws.com/groups/global/AllUsers</URI></Grantee><Permission>READ</Permission></Grant><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Group"><URI>http://acs.amazonaws.com/groups/global/AllUsers</URI></Grantee><Permission>READ_ACP</Permission></Grant></AccessControlList></AccessControlPolicy>`;
export const samplePermissions = {
  AllUsers: ["READ", "READ_ACP"],
  AuthenticatedUsers: ["READ", "READ_ACP"],
  LogDelivery: [],
};
