import { onMessage } from "webext-bridge/background";
import { bucketRecorder } from "@/lib/bucket";
import { logger } from "@/lib/logger";

export default defineBackground({
  persistent: true,
  main: () => {
    const proxyBucketRecorder = (
      request: Browser.webRequest.WebResponseHeadersDetails,
    ) => {
      bucketRecorder(request);
    };

    logger("Background script loaded");
    const interceptedRequests = browser.webRequest.onHeadersReceived;
    setToRecord({ data: true });

    // Listen for messages to toggle recording
    onMessage("setToRecord", setToRecord);

    function setToRecord({ data }: { data: boolean }): void {
      // * Required since onHeadersReceived listener won't accept async function

      if (data) {
        logger("Recording started");
        interceptedRequests.addListener(
          proxyBucketRecorder, // Handles bucket recording
          { urls: ["<all_urls>"] },
          ["responseHeaders"],
        );
      } else {
        logger("Recording stopped");
        interceptedRequests.removeListener(proxyBucketRecorder);
      }
    }
  },
});
