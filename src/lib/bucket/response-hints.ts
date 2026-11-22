/** Chrome can hide redirect headers from fetch (opaqueredirect). Observe only
 * this extension's matching request through its existing webRequest permission.
 * Never retain the URL, other headers, or request IDs in returned evidence. */
export function responseHints(target: string, method: string) {
  const metadata: { region?: string; status?: number } = {};
  let seen = false;
  let attached = false;
  let wake: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let origin = "";
  const receive = (request: Browser.webRequest.WebResponseHeadersDetails) => {
    const initiator =
      request.initiator ??
      ("originUrl" in request && typeof request.originUrl === "string"
        ? request.originUrl
        : "");
    if (
      !origin ||
      !(initiator === origin || initiator.startsWith(`${origin}/`)) ||
      request.url !== target ||
      request.method !== method
    )
      return;
    const value = request.responseHeaders?.find(
      (header) => header.name.toLowerCase() === "x-amz-bucket-region",
    )?.value;
    if (value && /^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(value))
      metadata.region = value;
    metadata.status = request.statusCode || undefined;
    seen = true;
    wake?.();
  };
  try {
    origin = browser.runtime.getURL("/").replace(/\/$/, "");
    browser.webRequest.onHeadersReceived.addListener(
      receive,
      { urls: [`${new URL(target).origin}/*`] },
      ["responseHeaders"],
    );
    attached = true;
  } catch {
    /* Fetch headers remain the fallback when observation is unavailable. */
  }
  return {
    metadata,
    wait: async () => {
      if (!attached || seen) return;
      await new Promise<void>((resolve) => {
        wake = () => {
          if (timer) clearTimeout(timer);
          resolve();
        };
        timer = setTimeout(resolve, 100);
      });
    },
    close: () => {
      if (timer) clearTimeout(timer);
      wake?.();
      if (attached) {
        try {
          browser.webRequest.onHeadersReceived.removeListener(receive);
        } catch {
          /* Worker may have been invalidated. */
        }
      }
    },
  };
}
