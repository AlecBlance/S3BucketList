import { sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { setTimeout } from "node:timers/promises";

// Deliberately fixed: this workflow must never publish another extension.
export const extensionId = "anngjobjhcbancaaogmlcffohpmcniki";
const tokenUrl = "https://oauth2.googleapis.com/token";
const scope = "https://www.googleapis.com/auth/chromewebstore";
const apiOrigin = "https://chromewebstore.googleapis.com";

export async function publishChrome({
  credentials,
  publisherId,
  version,
  zipPath,
  dryRun = false,
  fetchImpl = fetch,
  readFileImpl = readFile,
  wait = setTimeout,
  log = console.log,
}) {
  if (!credentials)
    throw new Error("Missing CHROME_SERVICE_ACCOUNT_KEY secret");
  if (!publisherId || !/^[a-zA-Z0-9-]+$/.test(publisherId)) {
    throw new Error("Missing or invalid CHROME_PUBLISHER_ID secret");
  }
  if (!version) throw new Error("Missing release version");
  const key = JSON.parse(credentials);
  if (key.type !== "service_account" || !key.client_email || !key.private_key) {
    throw new Error(
      "CHROME_SERVICE_ACCOUNT_KEY must contain a service account JSON key",
    );
  }
  // Check the artifact before making any authenticated requests.
  const zip = dryRun ? undefined : await readFileImpl(zipPath);
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: key.client_email,
    scope,
    aud: tokenUrl,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = sign("RSA-SHA256", Buffer.from(unsigned), key.private_key);
  const assertion = `${unsigned}.${signature.toString("base64url")}`;
  const tokenResponse = await fetchImpl(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!tokenResponse.ok) {
    throw new Error(
      `Google service account authentication failed (HTTP ${tokenResponse.status})`,
    );
  }
  const { access_token: token } = await tokenResponse.json();
  if (!token) throw new Error("Google did not return an access token");

  const resource = `publishers/${publisherId}/items/${extensionId}`;
  async function request(url, options = {}) {
    const response = await fetchImpl(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      // Never print request bodies, credentials, or bearer tokens.
      throw new Error(
        `Chrome Web Store request failed (HTTP ${response.status}); check the developer dashboard`,
      );
    }
    return response.json();
  }
  const statusUrl = `${apiOrigin}/v2/${resource}:fetchStatus`;
  const status = await request(statusUrl);
  if (status.itemId !== extensionId) {
    throw new Error("Chrome Web Store returned an unexpected extension ID");
  }
  if (dryRun) {
    log(
      `Authentication and read access verified for S3BucketList (${extensionId}). No upload or publish performed.`,
    );
    return status;
  }
  if (status.takenDown || status.warned) {
    throw new Error(
      "Resolve the store policy warning or takedown before publishing",
    );
  }
  const submitted = status.submittedItemRevisionStatus;
  const published = status.publishedItemRevisionStatus;
  const hasVersion = (revision) =>
    revision?.distributionChannels?.some(
      (channel) => channel.crxVersion === version,
    );
  if (hasVersion(published)) {
    log(
      `Version ${version} is already published; no upload or publish performed.`,
    );
    return status;
  }
  if (["PENDING_REVIEW", "STAGED"].includes(submitted?.state)) {
    if (hasVersion(submitted)) {
      log(
        `Version ${version} is already submitted (${submitted.state}); no upload or publish performed.`,
      );
      return status;
    }
    throw new Error(
      "Another version is pending review or staged; resolve it in the developer dashboard first",
    );
  }
  const upload = await request(`${apiOrigin}/upload/v2/${resource}:upload`, {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: zip,
  });
  let uploadState = upload.uploadState;
  for (
    let attempt = 0;
    uploadState === "IN_PROGRESS" && attempt < 30;
    attempt++
  ) {
    await wait(2000);
    uploadState = (await request(statusUrl)).lastAsyncUploadState;
  }
  if (uploadState !== "SUCCEEDED") {
    throw new Error(
      `Chrome upload did not succeed (${uploadState ?? "unknown"}); no publish requested`,
    );
  }
  const result = await request(`${apiOrigin}/v2/${resource}:publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publishType: "DEFAULT_PUBLISH",
      skipReview: false,
      blockOnWarnings: true,
    }),
  });
  if (!["PENDING_REVIEW", "PUBLISHED"].includes(result.state)) {
    throw new Error(
      `Unexpected submission state: ${result.state ?? "unknown"}; check the developer dashboard`,
    );
  }
  log(
    `S3BucketList ${version} submitted (${result.state}). Google publishes it automatically after approval.`,
  );
  return result;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const { version } = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    );
    await publishChrome({
      credentials: process.env.CHROME_SERVICE_ACCOUNT_KEY,
      publisherId: process.env.CHROME_PUBLISHER_ID,
      version,
      zipPath: process.argv[2],
      dryRun: process.argv.includes("--dry-run"),
    });
  } catch (error) {
    // Avoid accidentally exposing JSON credential content in a parse error.
    console.error(
      error instanceof SyntaxError
        ? "Invalid service account JSON"
        : error.message,
    );
    process.exitCode = 1;
  }
}
