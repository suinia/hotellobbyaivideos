type HistoryJob = { id: string; updatedAt: string; status: string; error?: string | null };

// A writer updates the local cache before awaiting durable persistence. Only
// retry this consistency window; database/ownership errors must propagate.
export async function readConsistentPersistedSessionJobs<T extends HistoryJob>(options: {
  readLocal: () => T[];
  readPersisted: () => Promise<T[]>;
  wait?: (milliseconds: number) => Promise<void>;
}): Promise<T[]> {
  const delays = [100, 250, 500];
  const wait = options.wait ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  for (let attempt = 0; ; attempt += 1) {
    const persisted = await options.readPersisted();
    // Read local state AFTER the await, including writes begun during the read.
    const local = options.readLocal();
    const byId = new Map(persisted.map((job) => [job.id, job]));
    const missing = local.find((job) => !byId.has(job.id));
    const newer = local.find((job) => {
      const remote = byId.get(job.id);
      if (!remote) return false;
      const localTime = Date.parse(job.updatedAt);
      const remoteTime = Date.parse(remote.updatedAt);
      return localTime > remoteTime || (localTime === remoteTime
        && (job.status !== remote.status || job.error !== remote.error));
    });
    if (!missing && !newer) return persisted;
    if (attempt === delays.length) {
      throw new Error(`Unable to load complete persisted session history: job ${(missing ?? newer)!.id} ${missing ? "is only available locally" : "has newer local state"}.`);
    }
    await wait(delays[attempt]!);
  }
}
