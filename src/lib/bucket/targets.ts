import { parseS3Url } from "./endpoints";
export function parseBucketInput(input: string) {
  if (typeof input !== "string" || !input.trim() || input.length > 2048)
    throw new Error("Enter a bucket name or direct S3 bucket URL.");
  const text = input.trim();
  let raw = text;
  if (text.startsWith("s3://")) {
    let uri: URL;
    try {
      uri = new URL(text);
    } catch {
      throw new Error("Enter a valid s3://bucket-name address.");
    }
    if (
      uri.username ||
      uri.password ||
      uri.port ||
      uri.search ||
      uri.hash ||
      !["", "/"].includes(uri.pathname)
    )
      throw new Error(
        "Use a bucket address without a file path, credentials, or query parameters.",
      );
    raw = `https://${uri.hostname}.s3.amazonaws.com/`;
  } else if (!text.includes("://")) {
    if (text.includes(".amazonaws.com")) raw = `https://${text}`;
    else {
      if (!/^[a-z0-9][a-z0-9._-]{1,253}[a-z0-9]$/.test(text))
        throw new Error(
          "Use an exact bucket name or direct S3 bucket URL, one per line.",
        );
      raw = `https://${text}.s3.amazonaws.com/`;
    }
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid S3 bucket URL.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use a bucket URL without credentials, signing parameters, ports, or fragments.",
    );
  const endpoint = parseS3Url(url.href);
  if (!endpoint?.bucket || !endpoint.apiUrl || endpoint.object)
    throw new Error(
      "Use a direct S3 bucket root. A CDN address or file URL is not accepted.",
    );
  return endpoint;
}
