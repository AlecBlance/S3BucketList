import { afterEach, describe, expect, it, vi } from "vitest";
import { responseHints } from "./response-hints";
import { s3Request } from "@/_test/index.config";
afterEach(() => vi.restoreAllMocks());
describe("redirect hints from the extension's own requests", () => {
  it("accepts only the exact method, URL, and initiating extension, then removes its listener", async () => {
    const add = vi
      .spyOn(browser.webRequest.onHeadersReceived, "addListener")
      .mockImplementation(() => {});
    const remove = vi
      .spyOn(browser.webRequest.onHeadersReceived, "removeListener")
      .mockImplementation(() => {});
    const hints = responseHints("https://s3.amazonaws.com/sample/", "HEAD");
    const receive = add.mock.calls[0][0];
    const request = {
      ...s3Request,
      method: "HEAD",
      url: "https://s3.amazonaws.com/sample/",
      statusCode: 301,
      responseHeaders: [{ name: "x-amz-bucket-region", value: "eu-west-1" }],
    };
    receive({ ...request, initiator: "https://site.example" });
    expect(hints.metadata).toEqual({});
    receive({
      ...request,
      initiator: browser.runtime.getURL("/").replace(/\/$/, ""),
      method: "GET",
    });
    expect(hints.metadata).toEqual({});
    receive({
      ...request,
      initiator: browser.runtime.getURL("/").replace(/\/$/, ""),
    });
    await hints.wait();
    expect(hints.metadata).toEqual({ region: "eu-west-1", status: 301 });
    hints.close();
    expect(remove).toHaveBeenCalledWith(receive);
    expect(JSON.stringify(hints.metadata)).not.toContain("sample");
  });
});
