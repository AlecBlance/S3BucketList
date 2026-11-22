import type { IBucket, ICheckJob } from "@/@types";
import { jobsStorage } from "@/lib/storage";

interface JobStorage {
  getValue(): Promise<ICheckJob[]>;
  setValue(value: ICheckJob[]): Promise<void>;
}
type Runner = (job: ICheckJob, signal: AbortSignal) => Promise<void>;

export class CheckQueue {
  private chain: Promise<unknown> = Promise.resolve();
  private active = new Map<string, AbortController>();
  private waiters = new Map<
    string,
    { promise: Promise<void>; resolve(): void; reject(error: Error): void }
  >();
  private pumping = false;
  private lastStart = 0;
  constructor(
    private options: {
      run: Runner;
      storage: JobStorage;
      startInterval?: number;
      timeout?: number;
    },
  ) {}

  private mutate(change: (jobs: ICheckJob[]) => ICheckJob[]) {
    const operation = this.chain.then(async () => {
      const jobs = change(await this.options.storage.getValue());
      const pending = jobs.filter((job) =>
        ["queued", "running"].includes(job.state),
      );
      const terminal = jobs
        .filter((job) => !["queued", "running"].includes(job.state))
        .slice(-200);
      const bounded = [...terminal, ...pending];
      await this.options.storage.setValue(bounded);
      return bounded;
    });
    this.chain = operation.catch(() => undefined);
    return operation;
  }

  async enqueue(bucket: IBucket, reason: "auto" | "manual") {
    let id = "";
    await this.mutate((jobs) => {
      const existing = jobs.find(
        (job) =>
          job.hostname === bucket.hostname &&
          job.recordId === bucket.recordId &&
          ["queued", "running"].includes(job.state),
      );
      if (existing) {
        id = existing.id;
        return jobs;
      }
      if (
        jobs.filter((job) => ["queued", "running"].includes(job.state))
          .length >= 200
      ) {
        throw new Error("Check queue is full. Wait for checks to finish.");
      }
      id = crypto.randomUUID();
      const at = Date.now();
      return [
        ...jobs,
        {
          id,
          hostname: bucket.hostname,
          recordId: bucket.recordId,
          state: "queued",
          attempts: 0,
          createdAt: at,
          updatedAt: at,
          reason,
        },
      ];
    });
    let waiter = this.waiters.get(id);
    if (!waiter) {
      let resolve!: () => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<void>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      void promise.catch(() => undefined);
      waiter = { promise, resolve, reject };
      this.waiters.set(id, waiter);
    }
    void this.pump().catch(() => undefined);
    return { id, finished: waiter.promise };
  }

  async recover() {
    await this.mutate((jobs) =>
      jobs.map((job) =>
        job.state === "running" && !this.active.has(job.id)
          ? {
              ...job,
              state: job.attempts < 2 ? "queued" : "failed",
              updatedAt: Date.now(),
            }
          : job,
      ),
    );
    await this.pump();
  }

  async cancel(id: string) {
    await this.mutate((jobs) =>
      jobs.map((job) =>
        job.id === id && ["queued", "running"].includes(job.state)
          ? { ...job, state: "cancelled", updatedAt: Date.now() }
          : job,
      ),
    );
    this.active.get(id)?.abort("cancel");
    this.waiters.get(id)?.reject(new Error("Check cancelled"));
    this.waiters.delete(id);
  }

  async cancelFor(hostnames: string[]) {
    const jobs = await this.options.storage.getValue();
    for (const job of jobs.filter(
      (job) =>
        hostnames.includes(job.hostname) &&
        ["queued", "running"].includes(job.state),
    )) {
      await this.cancel(job.id);
    }
    await this.mutate((saved) =>
      saved.filter((job) => !hostnames.includes(job.hostname)),
    );
  }

  async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.active.size < 2) {
        let candidate: ICheckJob | undefined;
        await this.mutate((jobs) => {
          candidate = jobs.find(
            (job) => job.state === "queued" && !this.active.has(job.id),
          );
          return jobs;
        });
        if (!candidate) break;
        const interval = this.options.startInterval ?? 500;
        // A wall-clock adjustment must not stall persisted work for minutes.
        const delay = Math.min(
          interval,
          Math.max(0, interval - (Date.now() - this.lastStart)),
        );
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        const controller = new AbortController();
        let started = false;
        const selected = candidate;
        await this.mutate((jobs) =>
          jobs.map((job) => {
            if (job.id !== selected.id || job.state !== "queued") return job;
            started = true;
            return {
              ...job,
              state: "running",
              attempts: job.attempts + 1,
              updatedAt: Date.now(),
            };
          }),
        );
        if (!started) continue;
        this.active.set(selected.id, controller);
        this.lastStart = Date.now();
        void this.run(selected, controller).catch(() => undefined);
      }
    } finally {
      this.pumping = false;
    }
  }

  private async run(job: ICheckJob, controller: AbortController) {
    const timer = setTimeout(
      () => controller.abort("timeout"),
      this.options.timeout ?? 35_000,
    );
    let abortListener!: () => void;
    const aborted = new Promise<never>((_, reject) => {
      abortListener = () =>
        reject(
          new Error(
            controller.signal.reason === "cancel"
              ? "Check cancelled"
              : "Check timed out",
          ),
        );
      controller.signal.addEventListener("abort", abortListener, {
        once: true,
      });
    });
    try {
      await Promise.race([this.options.run(job, controller.signal), aborted]);
      await this.finish(job.id, "done");
      this.waiters.get(job.id)?.resolve();
    } catch (error) {
      await this.finish(
        job.id,
        controller.signal.reason === "cancel" ? "cancelled" : "failed",
      ).catch(() => undefined);
      this.waiters
        .get(job.id)
        ?.reject(
          new Error(error instanceof Error ? error.message : "Check failed"),
        );
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener("abort", abortListener);
      this.waiters.delete(job.id);
      this.active.delete(job.id);
      void this.pump().catch(() => undefined);
    }
  }

  private finish(id: string, state: ICheckJob["state"]) {
    return this.mutate((jobs) =>
      jobs.map((job) =>
        job.id === id && job.state !== "cancelled"
          ? { ...job, state, updatedAt: Date.now() }
          : job,
      ),
    );
  }
}

export const createInspectionQueue = (run: Runner) =>
  new CheckQueue({ run, storage: jobsStorage });
