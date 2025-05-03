import { onMessage } from "webext-bridge/background";
import { bucketRecorder } from "@/lib/bucket";

export default defineBackground({
  persistent: true,
  main: () => {
    console.log("Background script loaded");
    const interceptedRequests = browser.webRequest.onHeadersReceived;
    setToRecord({ data: true });

    // Listen for messages to toggle recording
    onMessage("setToRecord", setToRecord);

    function setToRecord({ data }: { data: boolean }): void {
      // * Required since onHeadersReceived listener won't accept async function
      const proxyBucketRecorder = (
        request: Browser.webRequest.WebResponseHeadersDetails
      ) => {
        bucketRecorder(request);
      };

      if (data) {
        console.log("Recording started");
        interceptedRequests.addListener(
          proxyBucketRecorder,
          { urls: ["<all_urls>"] },
          ["responseHeaders"]
        );
      } else {
        console.log("Recording stopped");
        interceptedRequests.removeListener(proxyBucketRecorder);
      }
    }
  },
});
