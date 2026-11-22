import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  hasListBucketPermission,
  getBucketInfo,
  getACLPermissions,
  isPublic,
} from "./info";
import {
  fakeAclData,
  fakeBucketData,
  samplePermissions,
} from "@/_test/index.config";
import { load } from "cheerio";
import { scanRequest, regionalEndpoint, REQUEST_TIMEOUT } from "./scanner";
import { parseS3Url } from "./endpoints";
const request = vi.fn<typeof fetch>();
const response = (data: string | null, status = 200, headers?: HeadersInit) =>
  new Response(data, { status, headers });
beforeEach(() => {
  fakeBrowser.reset();
  request.mockReset();
  vi.stubGlobal("fetch", request);
  request.mockImplementation(async (input, init) => {
    if (init?.method === "HEAD") return response(null);
    const url = new URL(String(input));
    return response(
      url.search === "?acl"
        ? fakeAclData
        : fakeBucketData.replace(
            "<Name>aneta</Name>",
            `<Name>${url.pathname.split("/")[1]}</Name>`,
          ),
    );
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("bucket permission checks", () => {
  it("keeps compatibility helpers without using a public/private UI verdict", () => {
    expect(hasListBucketPermission(load(fakeBucketData))).toBe(true);
    expect(hasListBucketPermission(load("Nothing"))).toBe(false);
    expect(getACLPermissions(load(fakeAclData))).toEqual(samplePermissions);
    expect(isPublic(samplePermissions)).toBe(true);
  });
  it("uses one region HEAD and bounded V2 listing / ACL checks without credentials", async () => {
    const info = await getBucketInfo("aneta.s3.amazonaws.com");
    expect(info.access).toMatchObject({
      listing: { result: "allowed" },
      acl: { result: "allowed" },
    });
    expect(request).toHaveBeenCalledTimes(3);
    expect(String(request.mock.calls[1][0])).toContain(
      "?list-type=2&max-keys=1",
    );
    expect(info.access?.listing?.keysReturned).toBe(1);
    expect(String(request.mock.calls[2][0])).toContain("?acl");
    for (const [, options] of request.mock.calls)
      expect(options).toMatchObject({
        credentials: "omit",
        redirect: "manual",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
    expect(info.scanTrace).toHaveLength(3);
    const exported = JSON.stringify(info);
    expect(exported).not.toMatch(/animations\.css|c7f6e570|<Owner>|<Contents>/);
    expect(info.access?.acl?.grants).toEqual(samplePermissions);
  });
  it("uses regional headers before checking permissions", async () => {
    request.mockImplementation(async (_url, init) =>
      init?.method === "HEAD"
        ? response(null, 403, { "x-amz-bucket-region": "eu-west-1" })
        : response("<Error><Code>AccessDenied</Code></Error>", 403),
    );
    const info = await getBucketInfo("sample.s3.amazonaws.com");
    expect(String(request.mock.calls[1][0])).toContain(
      "s3.eu-west-1.amazonaws.com/sample/",
    );
    expect(info.endpoint?.region).toBe("eu-west-1");
    expect(info.access?.listing?.result).toBe("denied");
  });
  it("retries a validated regional redirect once, without following an arbitrary Location", async () => {
    request.mockImplementation(async (input, init) => {
      if (init?.method === "HEAD") return response(null);
      const url = String(input);
      if (!url.includes("s3.eu-west-1."))
        return response(
          "<Error><Code>PermanentRedirect</Code><Region>eu-west-1</Region></Error>",
          301,
          { Location: "https://unrelated.example/secret" },
        );
      return response(
        url.endsWith("?acl")
          ? fakeAclData
          : fakeBucketData.replace("<Name>aneta</Name>", "<Name>sample</Name>"),
      );
    });
    const info = await getBucketInfo("sample.s3.amazonaws.com");
    expect(info.access?.listing?.result).toBe("allowed");
    expect(info.scanTrace).toHaveLength(5);
    expect(
      request.mock.calls.some(([url]) =>
        String(url).includes("unrelated.example"),
      ),
    ).toBe(false);
    expect(
      info.scanTrace?.filter((trace) => trace.reason === "wrong-region"),
    ).toHaveLength(2);
  });
  it("resolves browser-hidden redirect headers through the existing request observer", async () => {
    const listeners = new Set<
      (request: Browser.webRequest.WebResponseHeadersDetails) => void
    >();
    vi.spyOn(
      browser.webRequest.onHeadersReceived,
      "addListener",
    ).mockImplementation((listener) => {
      listeners.add(listener);
    });
    vi.spyOn(
      browser.webRequest.onHeadersReceived,
      "removeListener",
    ).mockImplementation((listener) => {
      listeners.delete(listener);
    });
    request.mockImplementation(async (input, init) => {
      if (init?.method === "HEAD") {
        for (const listener of listeners)
          listener({
            frameId: -1,
            parentFrameId: -1,
            requestId: "region",
            tabId: -1,
            timeStamp: Date.now(),
            type: "xmlhttprequest",
            statusLine: "",
            statusCode: 301,
            url: String(input),
            method: "HEAD",
            initiator: browser.runtime.getURL("/").replace(/\/$/, ""),
            responseHeaders: [
              { name: "x-amz-bucket-region", value: "eu-west-1" },
            ],
          });
        return {
          type: "opaqueredirect",
          status: 0,
          headers: new Headers(),
          body: null,
        } as Response;
      }
      expect(String(input)).toContain("s3.eu-west-1.amazonaws.com");
      return response(
        String(input).endsWith("?acl")
          ? fakeAclData
          : fakeBucketData.replace("<Name>aneta</Name>", "<Name>sample</Name>"),
      );
    });
    const info = await getBucketInfo("sample.s3.amazonaws.com");
    expect(info.access?.listing?.result).toBe("allowed");
    expect(info.endpoint?.region).toBe("eu-west-1");
    expect(listeners.size).toBe(0);
  });
  it("never crosses China, GovCloud, or commercial partition boundaries", () => {
    const cn = parseS3Url("https://sample.s3.cn-north-1.amazonaws.com.cn")!;
    expect(regionalEndpoint(cn, "us-east-1")).toBeUndefined();
    const gov = parseS3Url("https://sample.s3.us-gov-west-1.amazonaws.com")!;
    expect(regionalEndpoint(gov, "eu-west-1")).toBeUndefined();
    const aws = parseS3Url("https://sample.s3.amazonaws.com")!;
    expect(regionalEndpoint(aws, "cn-north-1")).toBeUndefined();
    expect(regionalEndpoint(aws, "us-iso-east-1")).toBeUndefined();
  });
  it("keeps listing denial separate from readable ACLs", async () => {
    request.mockImplementation(async (url, init) =>
      init?.method === "HEAD"
        ? response(null)
        : String(url).endsWith("?acl")
          ? response(fakeAclData)
          : response("<Error><Code>AccessDenied</Code></Error>", 403),
    );
    const info = await getBucketInfo("sample.s3.amazonaws.com");
    expect(info.access).toMatchObject({
      listing: { result: "denied" },
      acl: { result: "allowed" },
    });
  });
  it("keeps successful listing evidence if ACL has a network failure", async () => {
    request.mockImplementation(async (url, init) => {
      if (String(url).endsWith("?acl"))
        throw new Error("A network error containing PRIVATE URL");
      return init?.method === "HEAD"
        ? response(null)
        : response(fakeBucketData);
    });
    const info = await getBucketInfo("aneta.s3.amazonaws.com");
    expect(info.access).toMatchObject({
      listing: { result: "allowed" },
      acl: { result: "unknown", reason: "network" },
    });
    expect(JSON.stringify(info)).not.toContain("PRIVATE URL");
  });
  it.each([
    ["<html>Sign in</html>", 200, "unexpected"],
    ["<html><ListBucketResult/></html>", 200, "unexpected"],
    ["<ListBucketResult><broken></ListBucketResult>", 200, "unexpected"],
    [
      '<!DOCTYPE x [<!ENTITY x "secret">]><ListBucketResult>&x;</ListBucketResult>',
      200,
      "unexpected",
    ],
    ["<Error><Code>SlowDown</Code></Error>", 503, "throttled"],
    ["<Error><Code>NoSuchKey</Code></Error>", 404, "unexpected"],
    ["<Error><Code>NoSuchBucket</Code></Error>", 404, "missing-bucket"],
    ["<Error><Code>AccessDenied</Code></Error>", 403, "denied"],
  ])(
    "classifies %s without guessing a permission result",
    async (body, status, reason) => {
      request.mockImplementation(async (_url, init) =>
        init?.method === "HEAD"
          ? response(null)
          : response(body as string, status as number),
      );
      const info = await getBucketInfo("sample.s3.amazonaws.com");
      expect(info.access?.listing?.reason).toBe(reason);
      if (reason !== "missing-bucket") expect(info.owned).not.toBe(false);
      if (!["denied", "missing-bucket"].includes(reason as string))
        expect(info.access?.listing?.result).toBe("unknown");
    },
  );
  it("does not accept a listing naming a different bucket", async () => {
    request.mockImplementation(async (_url, init) =>
      init?.method === "HEAD" ? response(null) : response(fakeBucketData),
    );
    expect(
      (await getBucketInfo("other.s3.amazonaws.com")).access?.listing?.result,
    ).toBe("unknown");
  });
  it("supports XML namespaces and ignores spoofed ACL group URIs", () => {
    const xml = load(
      '<s:AccessControlPolicy xmlns:s="urn:s3"><s:AccessControlList><s:Grant><s:Grantee><s:URI>http://acs.amazonaws.com/groups/global/AllUsers</s:URI></s:Grantee><s:Permission>WRITE_ACP</s:Permission></s:Grant><s:Grant><s:Grantee><s:URI>https://evil.example/AllUsers</s:URI></s:Grantee><s:Permission>WRITE</s:Permission></s:Grant></s:AccessControlList><s:Unrelated><s:URI>http://acs.amazonaws.com/groups/global/AllUsers</s:URI><s:Permission>WRITE</s:Permission></s:Unrelated></s:AccessControlPolicy>',
      { xml: true },
    );
    expect(getACLPermissions(xml).AllUsers).toEqual(["WRITE_ACP"]);
  });
  it("stops oversized responses without retaining their data", async () => {
    request.mockResolvedValue(response("PRIVATE".repeat(20_000)));
    const result = await scanRequest(
      "https://s3.amazonaws.com/sample/?acl",
      "acl",
      "GET",
    );
    expect(result.trace.reason).toBe("too-large");
    expect(result.xml).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("distinguishes timeouts from permission denials and releases timers", async () => {
    vi.useFakeTimers();
    request.mockImplementation(
      (_input, options) =>
        new Promise((_, reject) =>
          options?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          ),
        ),
    );
    const pending = scanRequest(
      "https://s3.amazonaws.com/sample/",
      "region",
      "HEAD",
    );
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT + 1);
    const result = await pending;
    expect(result.trace.reason).toBe("timeout");
    expect(result.trace.status).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not send an already-cancelled request", async () => {
    const controller = new AbortController();
    controller.abort("cancel");
    const result = await scanRequest(
      "https://s3.amazonaws.com/sample/",
      "region",
      "HEAD",
      controller.signal,
    );
    expect(result.trace.reason).toBe("cancelled");
    expect(request).not.toHaveBeenCalled();
  });
  it("never guesses bucket targets from custom domains", async () => {
    expect((await getBucketInfo("cdn.example")).checkStatus).toBe("pending");
    expect(request).not.toHaveBeenCalled();
  });
});
