import { beforeEach, describe, expect, it, vi } from "vitest";
import Recorder from "./Recorder.class";
import { isRecordingStorage, settingsStorage } from "@/lib/storage";
import { s3Request } from "@/_test/index.config";

const { record } = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@/lib/bucket", () => ({ bucketRecorder: record }));

describe("Recorder lifecycle", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(
      browser.webRequest.onErrorOccurred,
      "addListener",
    ).mockImplementation(() => {});
    fakeBrowser.reset();
    await isRecordingStorage.setValue(true);
    await settingsStorage.setValue({ tabOnly: { enabled: false, tabIds: [] } });
    record.mockReset();
  });

  const setup = () => {
    const addListener = vi
      .spyOn(browser.webRequest.onHeadersReceived, "addListener")
      .mockImplementation(() => {});
    const recorder = new Recorder();
    expect(addListener).toHaveBeenCalledOnce();
    return { recorder, receive: recorder["recordRequest"], addListener };
  };

  it("restores a paused state before handling the first request", async () => {
    await isRecordingStorage.setValue(false);
    const { receive } = setup();
    await receive(s3Request);
    expect(record).not.toHaveBeenCalled();
  });

  it("restores selected-tab restrictions before handling requests", async () => {
    await settingsStorage.setValue({
      tabOnly: { enabled: true, tabIds: ["42"] },
    });
    const { receive } = setup();
    await receive(s3Request);
    expect(record).not.toHaveBeenCalled();
    await receive({ ...s3Request, tabId: 42 });
    expect(record).toHaveBeenCalledOnce();
  });

  it("ignores saved tab IDs when tab-only recording is disabled", async () => {
    await settingsStorage.setValue({
      tabOnly: { enabled: false, tabIds: ["42"] },
    });
    const { receive } = setup();
    await receive(s3Request);
    expect(record).toHaveBeenCalledOnce();
  });

  it("persists toggles without registering duplicate listeners", async () => {
    const { recorder, receive, addListener } = setup();
    await recorder.stopRecording();
    expect(await isRecordingStorage.getValue()).toBe(false);
    await receive(s3Request);
    expect(record).not.toHaveBeenCalled();
    await recorder.startRecording();
    await recorder.startRecording();
    expect(await isRecordingStorage.getValue()).toBe(true);
    await receive(s3Request);
    expect(record).toHaveBeenCalledOnce();
    expect(addListener).toHaveBeenCalledOnce();
  });

  it("fails closed when settings cannot be restored", async () => {
    vi.spyOn(isRecordingStorage, "getValue").mockRejectedValueOnce(
      new Error("Read failed"),
    );
    const { receive } = setup();
    await receive(s3Request);
    expect(record).not.toHaveBeenCalled();
  });

  it("captures failed requests without response headers, without counting one request twice", async () => {
    const { recorder, addListener } = setup();
    await recorder.startRecording();
    const fail = vi.mocked(browser.webRequest.onErrorOccurred.addListener).mock
      .calls[0][0];
    const errorRequest = {
      ...s3Request,
      error: "net::ERR_CONNECTION_RESET",
      fromCache: false,
    };
    fail(errorRequest);
    await vi.waitFor(() => expect(record).toHaveBeenCalledOnce());
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 0,
        responseHeaders: [],
      }),
    );
    record.mockClear();
    addListener.mock.calls[0][0]({ ...s3Request, requestId: "headers-seen" });
    await vi.waitFor(() => expect(record).toHaveBeenCalledOnce());
    fail({ ...errorRequest, requestId: "headers-seen" });
    await Promise.resolve();
    expect(record).toHaveBeenCalledOnce();
  });
});
