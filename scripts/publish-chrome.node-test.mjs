import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import { extensionId, publishChrome } from "./publish-chrome.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const credentials = JSON.stringify({
  type: "service_account",
  client_email: "publisher@example.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
});
const status = { itemId: extensionId };
const token = { access_token: "test-token" };
const revision = (version, state = "PENDING_REVIEW") => ({
  state,
  distributionChannels: [{ crxVersion: version }],
});

function harness(responses) {
  const calls = [];
  const logs = [];
  let reads = 0;
  let waits = 0;
  return {
    calls,
    logs,
    get reads() {
      return reads;
    },
    get waits() {
      return waits;
    },
    options: {
      credentials,
      publisherId: "test-publisher",
      version: "4.1.3",
      zipPath: "release.zip",
      readFileImpl: async () => {
        reads++;
        return Buffer.from("test-zip");
      },
      log: (message) => logs.push(message),
      wait: async () => {
        waits++;
      },
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        const response = responses.shift();
        assert(response, `Unexpected request to ${url}`);
        return {
          ok: !response.httpStatus,
          status: response.httpStatus ?? 200,
          json: async () => response,
        };
      },
    },
  };
}

test("dry run only authenticates and reads the fixed extension; JWT is signed and scoped", async () => {
  const h = harness([token, status]);
  await publishChrome({ ...h.options, dryRun: true });
  assert.equal(h.reads, 0);
  assert.equal(h.calls.length, 2);
  assert(h.calls[1].url.endsWith(`/items/${extensionId}:fetchStatus`));
  assert.equal(h.calls[1].options.Authorization, undefined);
  assert.equal(h.calls[1].options.headers.Authorization, "Bearer test-token");
  const jwt = h.calls[0].options.body.get("assertion");
  const [header, payload, signature] = jwt.split(".");
  assert(
    verify(
      "RSA-SHA256",
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature, "base64url"),
    ),
  );
  const claims = JSON.parse(Buffer.from(payload, "base64url"));
  assert.equal(claims.scope, "https://www.googleapis.com/auth/chromewebstore");
  assert.equal(claims.aud, "https://oauth2.googleapis.com/token");
  assert(!h.logs.join("").includes("test-token"));
});

test("uploads the ZIP and requests automatic publication after normal review", async () => {
  const h = harness([
    token,
    status,
    { uploadState: "SUCCEEDED" },
    { state: "PENDING_REVIEW" },
  ]);
  await publishChrome(h.options);
  assert.equal(h.calls.length, 4);
  assert(h.calls[2].url.includes("/upload/v2/"));
  assert.equal(h.calls[2].options.body.toString(), "test-zip");
  assert.deepEqual(JSON.parse(h.calls[3].options.body), {
    publishType: "DEFAULT_PUBLISH",
    skipReview: false,
    blockOnWarnings: true,
  });
});

test("waits for an asynchronous upload before publishing", async () => {
  const h = harness([
    token,
    status,
    { uploadState: "IN_PROGRESS" },
    { lastAsyncUploadState: "IN_PROGRESS" },
    { lastAsyncUploadState: "SUCCEEDED" },
    { state: "PENDING_REVIEW" },
  ]);
  await publishChrome(h.options);
  assert.equal(h.waits, 2);
  assert(h.calls.at(-1).url.endsWith(":publish"));
});

test("failed or timed-out uploads never publish", async () => {
  for (const state of ["FAILED", "IN_PROGRESS"]) {
    const responses = [token, status, { uploadState: state }];
    if (state === "IN_PROGRESS")
      responses.push(...Array(30).fill({ lastAsyncUploadState: state }));
    const h = harness(responses);
    await assert.rejects(publishChrome(h.options), /upload did not succeed/);
    assert(!h.calls.some((call) => call.url.endsWith(":publish")));
  }
});

test("skips the same version if already published, pending review, or staged", async () => {
  for (const state of ["PUBLISHED", "PENDING_REVIEW", "STAGED"]) {
    const property =
      state === "PUBLISHED"
        ? "publishedItemRevisionStatus"
        : "submittedItemRevisionStatus";
    const h = harness([
      token,
      { ...status, [property]: revision("4.1.3", state) },
    ]);
    await publishChrome(h.options);
    assert.equal(h.calls.length, 2);
  }
});

test("does not replace another pending or staged version", async () => {
  for (const state of ["PENDING_REVIEW", "STAGED"]) {
    const h = harness([
      token,
      { ...status, submittedItemRevisionStatus: revision("4.1.4", state) },
    ]);
    await assert.rejects(publishChrome(h.options), /Another version/);
    assert.equal(h.calls.length, 2);
  }
});

test("rejects unexpected extension IDs and store policy problems", async () => {
  for (const response of [
    { itemId: "other-extension" },
    { ...status, warned: true },
    { ...status, takenDown: true },
  ]) {
    const h = harness([token, response]);
    await assert.rejects(publishChrome(h.options));
    assert.equal(h.calls.length, 2);
  }
});

test("missing secrets fail before network access", async () => {
  for (const overrides of [{ credentials: "" }, { publisherId: "" }]) {
    const h = harness([]);
    await assert.rejects(
      publishChrome({ ...h.options, ...overrides }),
      /Missing/,
    );
    assert.equal(h.calls.length, 0);
  }
});

test("authentication and API errors stop before upload", async () => {
  for (const responses of [
    [{ httpStatus: 401 }],
    [token, { httpStatus: 403 }],
    [{}],
  ]) {
    const h = harness(responses);
    await assert.rejects(publishChrome(h.options));
    assert(h.calls.length <= 2);
  }
});
