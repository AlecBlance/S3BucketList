import { onMessage } from "webext-bridge/background";
import { logger } from "@/lib/logger";
import Recorder from "@/lib/bucket/Recorder.class";
import {
  removeFromBucketStorage,
  retryBucketInspection,
  recoverCheckJobs,
  annotateBucket,
  queueBucketCheck,
  cancelCheck,
  cancelBucketChecks,
  savePageReferences,
  setBucketReview,
  verifyBucketObject,
  previewBucketObjects,
  addBucketTargets,
} from "@/lib/bucket/recorder";
import { bucketsStorage, settingsStorage } from "@/lib/storage";
import { collectPageReferences } from "@/lib/bucket/extract";
import type { WorkspaceCommand } from "@/lib/workspace-client";
import { runtimeHandler } from "@/lib/runtime-handler";
import {
  acknowledgeTabDiscoveries,
  forgetTabDiscoveries,
} from "@/lib/bucket/tab-discoveries";

export default defineBackground({
  persistent: true,
  main: () => {
    logger("Background script loaded");
    const ready = recoverCheckJobs().catch(() =>
      logger("Could not restore checks"),
    );
    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "bucket-checks")
        void recoverCheckJobs(false).catch(() =>
          logger("Could not resume checks"),
        );
    });
    void browser.alarms.create("bucket-checks", { periodInMinutes: 1 });
    const recorder = new Recorder();
    browser.tabs.onRemoved.addListener((tabId) => {
      void forgetTabDiscoveries(tabId).catch(() => undefined);
    });
    // Clear the global badge from earlier versions; this version uses tab badges.
    void (browser.action ?? browser.browserAction)
      .setBadgeText({ text: "" })
      .catch(() => undefined);

    browser.runtime.onMessage.addListener(
      runtimeHandler((raw, sender) => {
        const message = raw as { workspace: 1; command: WorkspaceCommand };
        if (
          sender.id !== browser.runtime.id ||
          !sender.url?.startsWith(browser.runtime.getURL("/"))
        ) {
          return Promise.resolve({ ok: false, error: "Extension pages only." });
        }
        return (async () => {
          await ready;
          try {
            const command = message.command as WorkspaceCommand;
            if (!command || typeof command.type !== "string")
              throw new Error("Invalid command.");
            let value: unknown;
            switch (command.type) {
              case "popup:acknowledge-tab":
                await acknowledgeTabDiscoveries(command.tabId);
                break;
              case "buckets:add":
                value = await addBucketTargets(command.inputs);
                break;
              case "buckets:verify-object":
                value = await verifyBucketObject(
                  command.hostname,
                  command.url,
                  command.content,
                );
                break;
              case "buckets:browse":
                value = await previewBucketObjects(
                  command.hostname,
                  command.prefix,
                );
                break;
              case "buckets:review":
                value = await setBucketReview(command.hostname, command.status);
                break;
              case "scope:set": {
                if (
                  !Array.isArray(command.tabIds) ||
                  command.tabIds.length > 1000 ||
                  !command.tabIds.every(
                    (id) => typeof id === "string" && /^\d{1,12}$/.test(id),
                  )
                ) {
                  throw new Error("Invalid recording tabs.");
                }
                const settings = await settingsStorage.getValue();
                await settingsStorage.setValue({
                  ...settings,
                  tabOnly: {
                    enabled: command.tabIds.length > 0,
                    tabIds: [...new Set(command.tabIds)],
                  },
                });
                await recorder.setTabs(command.tabIds);
                break;
              }
              case "buckets:queue":
              case "buckets:remove": {
                if (
                  !Array.isArray(command.hostnames) ||
                  command.hostnames.length > 100 ||
                  !command.hostnames.every(
                    (host) => typeof host === "string" && host.length < 300,
                  )
                ) {
                  throw new Error("Choose up to 100 saved buckets.");
                }
                if (command.type === "buckets:remove") {
                  await cancelBucketChecks(command.hostnames);
                  value = await removeFromBucketStorage(command.hostnames);
                } else {
                  const results = await Promise.allSettled(
                    [...new Set(command.hostnames)].map(queueBucketCheck),
                  );
                  value = {
                    queued: results.filter(
                      (result) => result.status === "fulfilled",
                    ).length,
                    skipped: results.filter(
                      (result) => result.status === "rejected",
                    ).length,
                  };
                }
                break;
              }
              case "jobs:cancel":
                if (typeof command.id !== "string" || command.id.length > 100)
                  throw new Error("Invalid job.");
                await cancelCheck(command.id);
                break;
              case "buckets:annotate":
                value = await annotateBucket(
                  command.hostname,
                  command.notes,
                  command.reviewStatus,
                );
                break;
              case "recording:set":
                if (typeof command.enabled !== "boolean")
                  throw new Error("Invalid recording setting.");
                await (command.enabled
                  ? recorder.startRecording()
                  : recorder.stopRecording());
                break;
              case "page:extract": {
                if (!Number.isInteger(command.tabId) || command.tabId < 0)
                  throw new Error("Choose a web page first.");
                const tab = await browser.tabs.get(command.tabId);
                if (!tab.active || !tab.url || !/^https?:\/\//.test(tab.url))
                  throw new Error("Open the popup on an active web page.");
                const results = await browser.scripting.executeScript({
                  target: { tabId: command.tabId },
                  func: collectPageReferences,
                });
                const extracted = results[0]?.result;
                if (!extracted) throw new Error("This page could not be read.");
                await savePageReferences(
                  extracted.references,
                  extracted.origin,
                );
                value = { found: extracted.references.length };
                break;
              }
              default:
                throw new Error("Unknown command.");
            }
            return { ok: true, value };
          } catch {
            return {
              ok: false,
              error:
                "Could not complete this action. Check the selected page or saved buckets and try again.",
            };
          }
        })();
      }),
    );

    onMessage("setToRecord", ({ data }) => {
      return data ? recorder.startRecording() : recorder.stopRecording();
    });

    onMessage("settings:tabOnly", ({ data }) => {
      return recorder.setTabs(data as string[]);
    });

    onMessage("buckets:remove", ({ data }) => {
      if (
        !Array.isArray(data) ||
        !data.every((value) => typeof value === "string")
      ) {
        throw new Error("Expected an array of bucket hostnames");
      }
      return removeFromBucketStorage(data);
    });
    onMessage("buckets:retry", async ({ data }) => {
      if (typeof data !== "string")
        throw new Error("Expected a bucket hostname");
      try {
        await retryBucketInspection(data);
      } catch {
        // The saved record reports the failed check without exposing request data.
        logger("Bucket check failed");
      }
      return bucketsStorage.getValue();
    });
    onMessage("buckets:annotate", ({ data }) =>
      annotateBucket(data?.hostname, data?.notes, data?.reviewStatus),
    );
  },
});
