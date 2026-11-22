import { useEffect, useState } from "react";
import type { IBucket, ICheckJob } from "@/@types";
import { bucketsStorage, jobsStorage, isRecordingStorage } from "@/lib/storage";
import { subscribeStorage } from "@/lib/subscribeStorage";

export function useWorkspaceData() {
  const [buckets, setBuckets] = useState<IBucket[]>([]);
  const [jobs, setJobs] = useState<ICheckJob[]>([]);
  const [recording, setRecording] = useState(false);
  useEffect(() => subscribeStorage(bucketsStorage, setBuckets), []);
  useEffect(() => subscribeStorage(jobsStorage, setJobs), []);
  useEffect(() => subscribeStorage(isRecordingStorage, setRecording), []);
  return { buckets, jobs, recording };
}
