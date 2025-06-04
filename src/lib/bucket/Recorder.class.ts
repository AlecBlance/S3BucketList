import { logger } from "../logger";
import { bucketRecorder } from "@/lib/bucket";

export default class Recorder {
  private interceptedRequests = browser.webRequest.onHeadersReceived;
  private tabs: string[] = [];

  public setTabs(tabs: string[]) {
    this.tabs = tabs;
  }

  private proxyBucketRecorder = (
    request: Browser.webRequest.WebResponseHeadersDetails,
  ) => {
    // Filter requests based on the tab IDs if tabs are set
    if (this.tabs.length && !this.tabs.includes(String(request.tabId))) return;
    bucketRecorder(request);
  };

  public stopRecording(): void {
    logger("Recording stopped");
    this.interceptedRequests.removeListener(this.proxyBucketRecorder);
  }

  public startRecording(): void {
    logger("Recording started");
    this.interceptedRequests.addListener(
      this.proxyBucketRecorder, // Handles bucket recording
      { urls: ["<all_urls>"] },
      ["responseHeaders"],
    );
  }
}
