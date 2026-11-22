import { IBucket } from "@/@types";
import { isReqBucket, getBucketInfo } from "@/lib/bucket";
import { bucketsStorage } from "@/lib/storage";
import { addBadgeNumber } from "./badge";
import { observeBucket } from "./observations";
import { parseS3Url } from "./endpoints";
import { appendCheck } from "./history";
import { createInspectionQueue } from "./jobs";
import type { ICheckSnapshot } from "@/@types";
import type { IPageReference } from "@/@types";
import { safeOrigin } from "./observations";
import {
  confirmedAccess,
  reconcileReview,
  captureReviewGrants,
} from "./triage";
import {
  checkObjectMetadata,
  checkObjectContent,
  objectTarget,
} from "./object-check";
import { browseObjects } from "./browse";
import { parseBucketInput } from "./targets";
const objectControllers = new Map<string, AbortController>();

const inFlightInspections = new Map<
  string,
  { promise: Promise<void>; signal?: AbortSignal; token: symbol }
>();

/**
 * Handles the checking of the request to see if it is an S3 bucket request
 * and if so, it retrieves the bucketname and permissions
 */
export const bucketRecorder = async (
  request: Browser.webRequest.WebResponseHeadersDetails,
) => {
  if (!isReqBucket(request)) return;
  const endpoint = parseS3Url(request.url, true);
  if (!endpoint) return;
  const region = request.responseHeaders?.find(
    (header) => header.name.toLowerCase() === "x-amz-bucket-region",
  )?.value;
  if (
    endpoint.bucket &&
    !endpoint.region &&
    region &&
    /^[a-z]{2}(?:-[a-z]+)+-\d$/.test(region)
  ) {
    const suffix =
      endpoint.partition === "aws-cn" ? "amazonaws.com.cn" : "amazonaws.com";
    const regional = parseS3Url(
      `https://s3.${region}.${suffix}/${endpoint.bucket}/`,
    );
    if (regional && regional.partition === endpoint.partition) {
      endpoint.region = regional.region;
      endpoint.apiUrl = regional.apiUrl;
    }
  }
  const bucketUrl = endpoint.hostname;
  const now = Date.now();
  // Persist the discovery before inspection. Every sighting updates local history.
  const buckets = await updateBucketStorage((buckets) => {
    const existing = buckets.find(
      (bucket) =>
        bucket.endpoint?.key === endpoint.key ||
        (!bucket.endpoint &&
          (bucket.hostname === bucketUrl ||
            parseS3Url(`https://${bucket.hostname}/`)?.key === endpoint.key)),
    );
    const bucket: IBucket = existing ?? {
      date: now,
      hostname: bucketUrl,
      permissions: {},
      public: false,
      checkStatus: "pending",
      recordId: crypto.randomUUID(),
      endpoint,
    };
    const observed = observeBucket(bucket, request, now);
    observed.discovery = "traffic";
    // Keep the latest known region/address for verification; custom/CDN identities stay separate.
    observed.endpoint =
      !endpoint.region && bucket.endpoint?.region
        ? {
            ...endpoint,
            region: bucket.endpoint.region,
            apiUrl: bucket.endpoint.apiUrl,
          }
        : endpoint;
    return existing
      ? buckets.map((item) => (item === existing ? observed : item))
      : [...buckets, observed];
  });
  const bucket = buckets.find((item) => item.endpoint?.key === endpoint.key)!;
  if (!bucket.endpoint?.apiUrl) return;
  // Legacy records were already inspected. Do not inspect them again automatically.
  if (
    !bucket.checkStatus ||
    bucket.checkStatus === "checked" ||
    bucket.checkStatus === "failed"
  )
    return;
  const job = await inspectionQueue.enqueue(bucket, "auto");
  await job.finished;
};

const inspectBucket = (
  bucket: IBucket,
  signal?: AbortSignal,
): Promise<void> => {
  const key = `${bucket.hostname}:${bucket.recordId}`;
  const pending = inFlightInspections.get(key);
  if (pending && !pending.signal?.aborted) return pending.promise;
  const token = Symbol(key);
  const inspection = (async () => {
    const update = (change: (current: IBucket) => IBucket) =>
      updateBucketStorage((buckets) =>
        buckets.map((current) =>
          current.hostname === bucket.hostname &&
          current.recordId === bucket.recordId &&
          inFlightInspections.get(key)?.token === token
            ? change(current)
            : current,
        ),
      );
    const current = await update((current) => ({
      ...current,
      checkStatus: "checking",
    }));
    if (
      !current.some(
        (item) =>
          item.recordId === bucket.recordId &&
          item.hostname === bucket.hostname,
      )
    )
      return;
    try {
      const info = await getBucketInfo(
        bucket.hostname,
        bucket.endpoint?.apiUrl,
        signal,
      );
      if (signal?.aborted) throw new Error("Check cancelled");
      const checkedAt = Date.now();
      const snapshot: ICheckSnapshot = {
        id: crypto.randomUUID(),
        at: checkedAt,
        state: info.checkStatus === "failed" ? "failed" : "checked",
        listing: info.access?.listing,
        acl: info.access?.acl,
        trace: info.scanTrace,
      };
      await update((current) =>
        reconcileReview(current, {
          ...current,
          ...info,
          hostname: current.hostname,
          date: current.date,
          recordId: current.recordId,
          initiator: current.initiator,
          observations: current.observations,
          checkHistory: appendCheck(current.checkHistory, snapshot),
          endpoint:
            info.endpoint && info.endpoint.key === current.endpoint?.key
              ? {
                  ...current.endpoint!,
                  region: info.endpoint?.region,
                  apiUrl: info.endpoint?.apiUrl,
                }
              : (current.endpoint ??
                info.endpoint ??
                parseS3Url(`https://${current.hostname}/`)),
          access: { ...current.access, ...info.access },
          checkStatus: info.checkStatus ?? "checked",
          checkedAt,
        }),
      );
      if (info.checkStatus === "failed") throw new Error("Check unclear");
    } catch (error) {
      if (error instanceof Error && error.message === "Check unclear")
        throw error;
      if (signal?.aborted && signal.reason === "cancel") {
        await update((current) => ({ ...current, checkStatus: "pending" }));
        throw error;
      }
      await update((current) => ({
        ...current,
        checkStatus: "failed",
        checkedAt: Date.now(),
        public: false,
        owned: undefined,
        permissions: {},
        access: {
          ...current.access,
          listing: { result: "unknown", at: Date.now() },
          acl: { result: "unknown", at: Date.now() },
        },
        checkHistory:
          error instanceof Error && error.message === "Check unclear"
            ? current.checkHistory
            : appendCheck(current.checkHistory, {
                id: crypto.randomUUID(),
                at: Date.now(),
                state: "failed",
                listing: { result: "unknown", at: Date.now() },
                acl: { result: "unknown", at: Date.now() },
              }),
      }));
      throw error;
    }
  })().finally(() => {
    if (inFlightInspections.get(key)?.token === token)
      inFlightInspections.delete(key);
  });
  inFlightInspections.set(key, { promise: inspection, signal, token });
  return inspection;
};

export const retryBucketInspection = async (
  hostname: string,
): Promise<void> => {
  const bucket = (await bucketsStorage.getValue()).find(
    (item) => item.hostname === hostname,
  );
  if (!bucket) throw new Error("Bucket not found");
  const job = await inspectionQueue.enqueue(bucket, "manual");
  await job.finished;
};

export const queueBucketCheck = async (hostname: string) => {
  const bucket = (await bucketsStorage.getValue()).find(
    (item) => item.hostname === hostname,
  );
  if (!bucket) throw new Error("Bucket not found");
  const endpoint = bucket.endpoint ?? parseS3Url(`https://${bucket.hostname}/`);
  if (!endpoint?.apiUrl) throw new Error("Bucket name is unknown");
  const job = await inspectionQueue.enqueue(bucket, "manual");
  return job.id;
};

export const recoverCheckJobs = async (resetInterrupted = true) => {
  if (resetInterrupted) await recoverInterruptedChecks();
  await inspectionQueue.recover();
};
export const cancelCheck = (id: string) => inspectionQueue.cancel(id);
export const cancelBucketChecks = (hostnames: string[]) => {
  for (const hostname of hostnames)
    objectControllers.get(hostname)?.abort("cancel");
  return inspectionQueue.cancelFor(hostnames);
};

export const verifyBucketObject = async (
  hostname: string,
  raw: string,
  content = false,
) => {
  if (typeof content !== "boolean") throw new Error("Invalid file test.");
  const bucket = (await bucketsStorage.getValue()).find(
    (item) => item.hostname === hostname,
  );
  if (!bucket) throw new Error("Bucket not found.");
  objectTarget(bucket, raw); // Validate before acquiring a slot or making any request.
  if (objectControllers.has(hostname) || objectControllers.size >= 2)
    throw new Error("A file test is already running. Wait for it to finish.");
  const controller = new AbortController();
  objectControllers.set(hostname, controller);
  try {
    const { check, trace } = await (
      content ? checkObjectContent : checkObjectMetadata
    )(bucket, raw, controller.signal);
    if (controller.signal.aborted) throw new Error("File test cancelled.");
    await updateBucketStorage((saved) =>
      saved.map((current) =>
        current.hostname === hostname && current.recordId === bucket.recordId
          ? reconcileReview(current, {
              ...current,
              [content ? "objectRead" : "objectHead"]: check,
              checkHistory: appendCheck(current.checkHistory, {
                id: crypto.randomUUID(),
                at: check.at,
                state: check.result === "unknown" ? "failed" : "checked",
                [content ? "objectRead" : "objectHead"]: check,
                trace: [trace],
              }),
            })
          : current,
      ),
    );
    return check;
  } finally {
    objectControllers.delete(hostname);
  }
};

export const previewBucketObjects = async (
  hostname: string,
  prefix: string,
) => {
  const bucket = (await bucketsStorage.getValue()).find(
    (item) => item.hostname === hostname,
  );
  if (!bucket) throw new Error("Bucket not found.");
  if (objectControllers.has(hostname) || objectControllers.size >= 2)
    throw new Error("A file test or preview is already running.");
  const controller = new AbortController();
  objectControllers.set(hostname, controller);
  try {
    const result = await browseObjects(bucket, prefix, controller.signal);
    if (controller.signal.aborted) throw new Error("Preview cancelled.");
    // No storage writes: prefix, keys, and listing response stay in memory.
    return result;
  } finally {
    objectControllers.delete(hostname);
  }
};

// A stopped worker cannot finish its old checks. Keep discoveries and allow retry.
export const recoverInterruptedChecks = (): Promise<IBucket[]> =>
  updateBucketStorage((buckets) =>
    buckets.map((bucket) =>
      bucket.checkStatus === "checking"
        ? { ...bucket, checkStatus: "pending" }
        : bucket,
    ),
  );

export const annotateBucket = async (
  hostname: string,
  notes: string,
  reviewStatus: NonNullable<IBucket["reviewStatus"]>,
): Promise<IBucket[]> => {
  if (
    typeof hostname !== "string" ||
    typeof notes !== "string" ||
    notes.length > 4000 ||
    !["todo", "expected", "reported", "fixed"].includes(reviewStatus)
  ) {
    throw new Error("Invalid bucket notes");
  }
  return updateBucketStorage((buckets) =>
    buckets.map((bucket) =>
      bucket.hostname === hostname
        ? {
            ...bucket,
            notes,
            reviewStatus,
            reviewBaseline:
              reviewStatus === "expected"
                ? bucket.reviewStatus === "expected"
                  ? (bucket.reviewBaseline ?? confirmedAccess(bucket))
                  : confirmedAccess(bucket)
                : undefined,
            reviewGrantBaseline:
              reviewStatus === "expected"
                ? bucket.reviewStatus === "expected"
                  ? (bucket.reviewGrantBaseline ?? captureReviewGrants(bucket))
                  : captureReviewGrants(bucket)
                : undefined,
          }
        : bucket,
    ),
  );
};

export const setBucketReview = async (
  hostname: string,
  status: "expected" | "todo",
) => {
  if (typeof hostname !== "string" || !["expected", "todo"].includes(status))
    throw new Error("Invalid review status");
  return updateBucketStorage((buckets) =>
    buckets.map((bucket) =>
      bucket.hostname === hostname
        ? {
            ...bucket,
            reviewStatus: status,
            reviewBaseline:
              status === "expected" ? confirmedAccess(bucket) : undefined,
            reviewGrantBaseline:
              status === "expected" ? captureReviewGrants(bucket) : undefined,
          }
        : bucket,
    ),
  );
};

export const addBucketTargets = async (inputs: string[]) => {
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > 100)
    throw new Error("Expected 1 to 100 bucket addresses.");
  const targets = inputs.map(parseBucketInput);
  let added = 0;
  await updateBucketStorage((saved) => {
    const result = [...saved];
    for (const endpoint of targets) {
      if (
        result.some(
          (bucket) =>
            (bucket.endpoint ?? parseS3Url(`https://${bucket.hostname}/`))
              ?.key === endpoint.key,
        )
      )
        continue;
      result.push({
        date: Date.now(),
        hostname: endpoint.hostname,
        permissions: {},
        public: false,
        endpoint,
        checkStatus: "pending",
        discovery: "manual",
        recordId: crypto.randomUUID(),
      });
      added++;
    }
    return result;
  });
  return { added };
};

/** Page references are leads only: never enqueue network checks here. */
export const savePageReferences = async (
  references: IPageReference[],
  source: string,
) => {
  const origin = safeOrigin(source);
  const now = Date.now();
  return updateBucketStorage((saved) => {
    const buckets = [...saved];
    for (const reference of references.slice(0, 200)) {
      const endpoint = parseS3Url(reference.url);
      if (!endpoint?.bucket) continue;
      const index = buckets.findIndex(
        (bucket) =>
          bucket.endpoint?.key === endpoint.key ||
          (!bucket.endpoint &&
            parseS3Url(`https://${bucket.hostname}/`)?.key === endpoint.key),
      );
      const existing = index >= 0 ? buckets[index] : undefined;
      const bucket: IBucket = existing ?? {
        date: now,
        hostname: endpoint.hostname,
        permissions: {},
        public: false,
        checkStatus: "pending",
        recordId: crypto.randomUUID(),
        endpoint,
        discovery: "reference",
      };
      const previous = bucket.observations;
      const updated: IBucket = {
        ...bucket,
        initiator: bucket.initiator ?? origin,
        access: {
          ...bucket.access,
          signedLink: bucket.access?.signedLink || reference.signed,
        },
        observations: {
          firstSeen: previous?.firstSeen ?? bucket.date,
          lastSeen: now,
          sightings: previous?.sightings ?? 0,
          references: (previous?.references ?? 0) + 1,
          sources: [
            ...new Set(
              [...(previous?.sources ?? []), origin].filter(
                (item): item is string => !!item,
              ),
            ),
          ].slice(-20),
          endpoints: [
            ...new Set([
              ...(previous?.endpoints ?? []),
              new URL(reference.url).origin,
            ]),
          ].slice(-20),
          signedUrl: previous?.signedUrl ?? false,
          lastStatus: previous?.lastStatus,
        },
      };
      if (index >= 0) buckets[index] = updated;
      else buckets.push(updated);
    }
    return buckets;
  });
};

/**
 * Cleans the url. Making sure it has this format: {bucketName}.s3.amazonaws.com or the original hostname
 * There are instances where the bucket name is a pathname
 */
export function cleanBucketUrl(hostname: string, pathname: string): string {
  return parseS3Url(`https://${hostname}${pathname}`)?.hostname ?? hostname;
}
// All mutations run in the background, including popup deletion requests.
let storageQueue: Promise<unknown> = Promise.resolve();

const updateBucketStorage = (
  update: (buckets: IBucket[]) => IBucket[],
): Promise<IBucket[]> => {
  const operation = storageQueue.then(async () => {
    const buckets = update(await bucketsStorage.getValue());
    await bucketsStorage.setValue(buckets);
    // A cosmetic badge failure must never block persistence or checking.
    await addBadgeNumber(buckets).catch(() => undefined);
    return buckets;
  });
  storageQueue = operation.catch(() => undefined);
  return operation;
};

export const addToBucketStorage = async (
  bucketInfo: IBucket,
): Promise<void> => {
  await updateBucketStorage((buckets) => {
    if (buckets.some((bucket) => bucket.hostname === bucketInfo.hostname))
      return buckets;
    return [...buckets, bucketInfo];
  });
};

export const removeFromBucketStorage = (
  hostnames: string[],
): Promise<IBucket[]> =>
  updateBucketStorage((buckets) =>
    buckets.filter((bucket) => !hostnames.includes(bucket.hostname)),
  );

const inspectionQueue = createInspectionQueue(async (job, signal) => {
  const bucket = (await bucketsStorage.getValue()).find(
    (item) => item.hostname === job.hostname && item.recordId === job.recordId,
  );
  if (!bucket) throw new Error("Bucket no longer exists");
  await inspectBucket(bucket, signal);
});
