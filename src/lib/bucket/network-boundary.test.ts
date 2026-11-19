import { expect, it, vi } from "vitest";
import Recorder from "./Recorder.class";
import { s3Request } from "@/_test/index.config";
import { logger } from "../logger";

const { record } = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@/lib/bucket", () => ({ bucketRecorder: record }));
vi.mock("../logger", () => ({ logger: vi.fn() }));

it("contains rejected inspections at the webRequest boundary", async () => {
  const addListener = vi
    .spyOn(browser.webRequest.onHeadersReceived, "addListener")
    .mockImplementation(() => {});
  const error = new Error("Network Error");
  record.mockRejectedValueOnce(error);
  new Recorder().startRecording();
  const receive = addListener.mock.calls[0][0];
  expect(receive(s3Request)).toBeUndefined();
  await vi.waitFor(() =>
    expect(logger).toHaveBeenCalledWith("Failed to record bucket:", error),
  );
  vi.restoreAllMocks();
});
