import { describe, it, expect, beforeEach } from "vitest";
import { hasFavicon } from "./index";

const request: Browser.webRequest.WebResponseHeadersDetails = {
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

describe("filter", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("should detect if request has favicon.ico", () => {
    const newReq = { ...request, url: "https://s3.amazonaws.com/favicon.ico" };
    expect(hasFavicon(newReq)).toBe(true);
    expect(hasFavicon(request)).toBe(false);
  });
});
