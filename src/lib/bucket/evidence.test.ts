import { describe, expect, it } from "vitest";
import { fakeIBucketInfo } from "@/_test/index.config";
import { evidenceExport, findingDraft, reproductionCommands } from "./evidence";
import { parseS3Url } from "./endpoints";
import { appendCheck, describeChange, isStale } from "./history";
import type { ICheckSnapshot } from "@/@types";

describe("evidence and retests", () => {
  it("exports sanitized checks and history with referring sites opt-in", () => {
    const bucket = {
      ...fakeIBucketInfo,
      notes: "PRIVATE NOTE",
      initiator: "https://secret.example/path?token=TOKEN",
      endpoint: parseS3Url(
        "https://sample.s3.amazonaws.com/file?X-Amz-Signature=TOKEN",
      ),
      access: {
        listing: {
          result: "allowed" as const,
          at: 10,
          endpoint: "https://sample.s3.amazonaws.com/file?token=TOKEN",
        },
      },
      observations: {
        firstSeen: 1,
        lastSeen: 2,
        sightings: 3,
        sources: ["https://secret.example/path?token=TOKEN"],
        endpoints: [],
        signedUrl: true,
      },
    };
    const data = JSON.stringify(evidenceExport([bucket]));
    expect(data).not.toMatch(/PRIVATE NOTE|TOKEN|secret\.example|\/file/);
    expect(data).toContain('"schemaVersion":1');
    expect(data).toContain('"authentication":"unsigned"');
    const withSites = JSON.stringify(evidenceExport([bucket], true));
    expect(withSites).toContain("https://secret.example");
    expect(withSites).not.toMatch(/TOKEN|\/path/);
  });
  it("generates only known unsigned read commands, and no commands for custom names", () => {
    const bucket = {
      ...fakeIBucketInfo,
      endpoint: parseS3Url(
        "https://test.bucket.s3.cn-north-1.amazonaws.com.cn/file?Signature=SECRET",
      ),
    };
    const commands = reproductionCommands(bucket);
    expect(commands).toContain(
      "https://s3.cn-north-1.amazonaws.com.cn/test.bucket/",
    );
    expect(commands).toContain("?acl");
    expect(commands).not.toMatch(/SECRET|\/file|--location|Authorization/);
    expect(
      reproductionCommands({
        ...bucket,
        endpoint: parseS3Url("https://cdn.example/file", true),
      }),
    ).toBe("");
    expect(findingDraft(bucket)).toContain(
      "No severity or business impact is assumed",
    );
  });
  it("bounds history while retaining the first check and first access evidence", () => {
    let history: ICheckSnapshot[] = [];
    for (let index = 0; index < 100; index++)
      history = appendCheck(history, {
        id: String(index),
        at: index,
        state: "checked",
        listing: { result: index === 3 ? "allowed" : "denied", at: index },
        acl: { result: index === 5 ? "allowed" : "denied", at: index },
      });
    expect(history).toHaveLength(50);
    expect(history.map((item) => item.id)).toEqual(
      expect.arrayContaining(["0", "3", "5", "99"]),
    );
    expect(
      describeChange(undefined, { id: "fail", at: 1, state: "failed" }),
    ).toContain("does not confirm a fix");
    expect(isStale({ ...fakeIBucketInfo, checkedAt: 1 }, 100_000_000)).toBe(
      true,
    );
  });
  it("exports diagnostic codes and metadata results without object paths, bodies, or owner IDs", () => {
    const data = JSON.stringify(
      evidenceExport([
        {
          ...fakeIBucketInfo,
          notes: "PRIVATE NOTE",
          objectHead: {
            result: "allowed",
            at: 2,
            endpoint:
              "https://sample.s3.amazonaws.com/private-file?token=SECRET",
          },
          scanTrace: [
            {
              operation: "listing",
              method: "GET",
              at: 1,
              durationMs: 10,
              status: 503,
              errorCode: "SlowDown",
              reason: "throttled",
              endpoint:
                "https://sample.s3.amazonaws.com/?list-type=2&max-keys=1&Signature=SECRET",
            },
          ],
          checkHistory: [
            {
              id: "test",
              at: 2,
              state: "checked",
              objectHead: { result: "allowed", at: 2 },
              trace: [
                {
                  operation: "object",
                  method: "HEAD",
                  at: 2,
                  durationMs: 3,
                  reason: "confirmed",
                  endpoint: "https://sample.s3.amazonaws.com/private-file",
                },
              ],
            },
          ],
        },
      ]),
    );
    expect(data).toContain("SlowDown");
    expect(data).toContain("objectMetadata");
    expect(data).not.toMatch(/SECRET|private-file|PRIVATE NOTE|user123/);
    expect(data).toContain("max-keys=1");
  });
});
