import { XMLValidator } from "fast-xml-parser";
import { load, type CheerioAPI } from "cheerio";
import type {
  IAccessCheck,
  IS3Endpoint,
  IScanAttempt,
  ScanReason,
} from "@/@types";
import { parseS3Url } from "./endpoints";
import { responseHints } from "./response-hints";

export const REQUEST_TIMEOUT = 8_000;
const MAX_RESPONSE = 64 * 1024;
export const LIST_QUERY = "?list-type=2&max-keys=1";
const errorCodes = new Set([
  "AccessDenied",
  "NoSuchBucket",
  "NoSuchKey",
  "SlowDown",
  "ServiceUnavailable",
  "InternalError",
  "PermanentRedirect",
  "TemporaryRedirect",
  "AuthorizationHeaderMalformed",
  "IncorrectEndpoint",
  "AllAccessDisabled",
  "InvalidAccessKeyId",
  "RequestTimeTooSkewed",
  "InvalidRequest",
]);
export function xmlDocument(text: string): CheerioAPI | undefined {
  try {
    if (
      !text ||
      /<!DOCTYPE|<!ENTITY/i.test(text) ||
      XMLValidator.validate(text) !== true
    )
      return;
    return load(text, { xml: true });
  } catch {
    return;
  }
}
export function rootName(xml?: CheerioAPI) {
  const element = xml?.root().children().first().get(0);
  return element && "name" in element
    ? element.name.split(":").at(-1)
    : undefined;
}
function xmlValue(xml: CheerioAPI | undefined, name: string): string {
  return (
    xml?.("*")
      .filter(
        (_, element) =>
          "name" in element && element.name.split(":").at(-1) === name,
      )
      .first()
      .text() ?? ""
  );
}
export function regionalEndpoint(
  endpoint: IS3Endpoint,
  region: string | undefined,
): IS3Endpoint | undefined {
  if (!endpoint.bucket || !region || !/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(region))
    return;
  if (
    endpoint.partition === "aws-cn"
      ? !region.startsWith("cn-")
      : endpoint.partition === "aws-us-gov"
        ? !region.startsWith("us-gov-")
        : /^(cn-|us-gov-|us-iso)/.test(region)
  )
    return;
  const suffix =
    endpoint.partition === "aws-cn" ? "amazonaws.com.cn" : "amazonaws.com";
  const next = parseS3Url(`https://s3.${region}.${suffix}/${endpoint.bucket}/`);
  return next?.key === endpoint.key
    ? { ...endpoint, region: next.region, apiUrl: next.apiUrl }
    : undefined;
}

interface WireResult {
  trace: IScanAttempt;
  xml?: CheerioAPI;
}
/** No credentials, redirects, raw response retention, or unbounded response bodies. */
export async function scanRequest(
  endpoint: string,
  operation: IScanAttempt["operation"],
  method: "GET" | "HEAD",
  signal?: AbortSignal,
): Promise<WireResult> {
  const at = Date.now();
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason ?? "cancel");
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(() => controller.abort("timeout"), REQUEST_TIMEOUT);
  const hints = responseHints(endpoint, method);
  const trace: IScanAttempt = {
    operation,
    method,
    endpoint: ["object", "content", "browse"].includes(operation)
      ? undefined
      : endpoint,
    at,
    durationMs: 0,
    reason: "network",
  };
  try {
    if (controller.signal.aborted) throw new Error("Cancelled");
    const response = await fetch(endpoint, {
      method,
      credentials: "omit",
      redirect: "manual",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
      ...(operation === "content" ? { headers: { Range: "bytes=0-0" } } : {}),
    });
    if (response.type === "opaqueredirect") await hints.wait();
    trace.status = response.status || hints.metadata.status;
    const region =
      response.headers.get("x-amz-bucket-region") ?? hints.metadata.region;
    if (region && /^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(region))
      trace.region = region;
    let text = "";
    if (operation === "content") {
      // Never parse or retain file bytes. A server may ignore Range; cancel that
      // response without reading it and do not call it one-byte proof.
      const validRange =
        response.status === 206 &&
        /^bytes 0-0\/[1-9]\d*$/.test(
          response.headers.get("content-range") ?? "",
        ) &&
        [null, "identity"].includes(response.headers.get("content-encoding"));
      let bytes = 0;
      if (validRange && response.body) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > 1) break;
          }
        } finally {
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
      } else await response.body?.cancel().catch(() => undefined);
      trace.reason =
        validRange && bytes === 1
          ? "confirmed"
          : [401, 403].includes(response.status)
            ? "denied"
            : response.status === 404
              ? "missing-object"
              : [301, 302, 307, 308].includes(trace.status ?? 0) ||
                  response.type === "opaqueredirect"
                ? "wrong-region"
                : [429, 500, 502, 503, 504].includes(response.status)
                  ? "throttled"
                  : "unexpected";
      return { trace };
    }
    if (method === "GET" && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bytes = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > MAX_RESPONSE) {
            trace.reason = "too-large";
            await reader.cancel().catch(() => undefined);
            return { trace };
          }
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        reader.releaseLock();
      }
    }
    const xml = xmlDocument(text);
    if (rootName(xml) === "Error") {
      const code = xmlValue(xml, "Code");
      trace.errorCode = errorCodes.has(code) ? code : "OtherS3Error";
      const xmlRegion = xmlValue(xml, "Region");
      if (!trace.region && /^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(xmlRegion))
        trace.region = xmlRegion;
    }
    trace.reason =
      response.type === "opaqueredirect" ||
      [301, 302, 307, 308].includes(response.status) ||
      [
        "PermanentRedirect",
        "TemporaryRedirect",
        "AuthorizationHeaderMalformed",
        "IncorrectEndpoint",
      ].includes(trace.errorCode ?? "")
        ? "wrong-region"
        : [429, 500, 502, 503, 504].includes(response.status) ||
            ["SlowDown", "ServiceUnavailable", "InternalError"].includes(
              trace.errorCode ?? "",
            )
          ? "throttled"
          : response.status === 404 && trace.errorCode === "NoSuchBucket"
            ? "missing-bucket"
            : response.status === 404 && operation === "object"
              ? "missing-object"
              : [401, 403].includes(response.status)
                ? "denied"
                : response.status >= 200 && response.status < 300
                  ? "confirmed"
                  : "unexpected";
    return { trace, xml };
  } catch {
    trace.status ??= hints.metadata.status;
    trace.region ??= hints.metadata.region;
    trace.reason = controller.signal.aborted
      ? controller.signal.reason === "timeout"
        ? "timeout"
        : "cancelled"
      : "network";
    return { trace };
  } finally {
    trace.durationMs = Math.max(0, Date.now() - at);
    clearTimeout(timer);
    hints.close();
    signal?.removeEventListener("abort", abort);
  }
}

export function accessResult(
  trace: IScanAttempt,
  valid: boolean,
): IAccessCheck {
  const reason: ScanReason =
    trace.reason === "confirmed" && !valid ? "unexpected" : trace.reason;
  return {
    result:
      reason === "confirmed"
        ? "allowed"
        : reason === "denied"
          ? "denied"
          : ["missing-bucket", "missing-object"].includes(reason)
            ? "missing"
            : "unknown",
    at: trace.at,
    status: trace.status,
    endpoint: trace.endpoint,
    reason,
    errorCode: trace.errorCode,
    durationMs: trace.durationMs,
  };
}

export async function bucketOperation(
  endpoint: IS3Endpoint,
  operation: "listing" | "acl",
  signal?: AbortSignal,
) {
  const traces: IScanAttempt[] = [];
  let current = endpoint;
  let xml: CheerioAPI | undefined;
  let check!: IAccessCheck;
  for (let attempt = 0; attempt < 2; attempt++) {
    const wire = await scanRequest(
      current.apiUrl! + (operation === "listing" ? LIST_QUERY : "?acl"),
      operation,
      "GET",
      signal,
    );
    xml = wire.xml;
    const correctName =
      operation !== "listing" ||
      !xmlValue(xml, "Name") ||
      xmlValue(xml, "Name") === endpoint.bucket;
    check = accessResult(
      wire.trace,
      correctName &&
        rootName(xml) ===
          (operation === "listing"
            ? "ListBucketResult"
            : "AccessControlPolicy"),
    );
    if (operation === "listing" && check.result === "allowed" && xml) {
      const count = xml
        .root()
        .children()
        .first()
        .children()
        .filter(
          (_, element) =>
            "name" in element && element.name.split(":").at(-1) === "Contents",
        )
        .filter(
          (_, element) =>
            xml!(element)
              .children()
              .filter(
                (_, child) =>
                  "name" in child && child.name.split(":").at(-1) === "Key",
              )
              .text().length > 0,
        ).length;
      if (count > 1) {
        check.result = "unknown";
        check.reason = "unexpected"; // Response violated the requested bound.
      } else check.keysReturned = count ? 1 : 0; // The key itself never leaves the parser.
    }
    wire.trace.reason = check.reason!;
    traces.push(wire.trace);
    const next = regionalEndpoint(current, wire.trace.region);
    if (
      attempt === 0 &&
      wire.trace.reason === "wrong-region" &&
      next?.apiUrl !== current.apiUrl &&
      next?.apiUrl &&
      !signal?.aborted
    ) {
      current = next;
      continue;
    }
    return {
      check,
      xml: check.result === "allowed" ? xml : undefined,
      endpoint: current,
      traces,
    };
  }
  return { check, xml, endpoint: current, traces };
}
