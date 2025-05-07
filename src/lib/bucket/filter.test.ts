import { describe, it, expect, beforeEach } from "vitest";
import { hasFavicon, isExtensionRequest, hasAmazonHeader } from "./filter";
import {
  extensionRequest,
  s3Request,
  faviconRequest,
  missingHeaderRequest,
} from "@/_test/index.config";

describe("filter", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("should detect if request has favicon.ico", () => {
    expect(hasFavicon(faviconRequest)).toBe(true);
    expect(hasFavicon(s3Request)).toBe(false);
  });

  it("should detect if request is from extension", () => {
    expect(isExtensionRequest(extensionRequest)).toBe(true);
    expect(isExtensionRequest(s3Request)).toBe(false);
  });

  it("should detect if request has amazon headers", () => {
    expect(hasAmazonHeader(s3Request)).toBe(true);
    expect(hasAmazonHeader(missingHeaderRequest)).toBe(false);
  });
});
