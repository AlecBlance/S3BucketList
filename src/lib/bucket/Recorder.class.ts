import { logger } from "../logger";
import { bucketRecorder } from "@/lib/bucket";
import { isRecordingStorage, settingsStorage } from "@/lib/storage";

export default class Recorder {
  private interceptedRequests = browser.webRequest.onHeadersReceived;
  private tabs: string[] = [];
  private recording = false;
  private ready: Promise<void>;
  private requestsWithHeaders = new Set<string>();

  constructor() {
    // Register synchronously so MV3 can wake the worker for webRequest events.
    this.interceptedRequests.addListener(
      this.proxyBucketRecorder,
      { urls: ["<all_urls>"] },
      ["responseHeaders"],
    );
    browser.webRequest.onErrorOccurred.addListener(
      (request) => {
        if (this.requestsWithHeaders.has(request.requestId)) return;
        this.proxyBucketRecorder({
          ...request,
          statusCode: 0,
          statusLine: "",
          responseHeaders: [],
        });
      },
      { urls: ["<all_urls>"] },
    );
    this.ready = this.restoreSettings();
  }

  private async restoreSettings(): Promise<void> {
    try {
      const [recording, settings] = await Promise.all([
        isRecordingStorage.getValue(),
        settingsStorage.getValue(),
      ]);
      this.tabs = settings.tabOnly.enabled ? settings.tabOnly.tabIds : [];
      this.recording = recording;
    } catch (error) {
      // Fail closed if persisted recording preferences cannot be loaded.
      logger("Failed to restore recording settings:", error);
    }
  }

  public async setTabs(tabs: string[]): Promise<void> {
    await this.ready;
    this.tabs = tabs;
  }

  private proxyBucketRecorder = (
    request: Browser.webRequest.WebResponseHeadersDetails,
  ): void => {
    this.requestsWithHeaders.add(request.requestId);
    if (this.requestsWithHeaders.size > 1000) {
      this.requestsWithHeaders.delete(
        this.requestsWithHeaders.values().next().value!,
      );
    }
    void this.recordRequest(request);
  };

  private recordRequest = async (
    request: Browser.webRequest.WebResponseHeadersDetails,
  ) => {
    try {
      await this.ready;
      if (!this.recording) return;
      if (this.tabs.length && !this.tabs.includes(String(request.tabId)))
        return;
      await bucketRecorder(request);
    } catch (error) {
      logger("Failed to record bucket:", error);
    }
  };

  public async stopRecording(): Promise<void> {
    await this.ready;
    await isRecordingStorage.setValue(false);
    logger("Recording stopped");
    this.recording = false;
  }

  public async startRecording(): Promise<void> {
    await this.ready;
    await isRecordingStorage.setValue(true);
    logger("Recording started");
    this.recording = true;
  }
}
