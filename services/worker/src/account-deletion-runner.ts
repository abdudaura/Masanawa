import type { DeletionJobLease, AccountDeletionFinancialScreen } from "@masanawa/postgres";

export interface DeletionQueuePort {
  claim(): Promise<DeletionJobLease | null>;
  park(lease: DeletionJobLease, result: {
    findingCodes: readonly string[];
    admissionFenced: boolean;
    retrySeconds: number;
    now: string;
  }): Promise<void>;
  fail(lease: DeletionJobLease, retrySeconds: number): Promise<void>;
}

export interface FinancialScreenPort {
  scan(input: { tenantId:string;userId:string;requestId:string;now:string; }): Promise<AccountDeletionFinancialScreen>;
}

export function createAccountDeletionRunner(input: {
  queue: DeletionQueuePort;
  financial: FinancialScreenPort;
  now?: () => string;
}) {
  const now = input.now ?? (() => new Date().toISOString());
  return {
    async runOnce(): Promise<"idle" | "held" | "review" | "retry"> {
      const lease = await input.queue.claim();
      if (!lease) return "idle";
      try {
        const scan = await input.financial.scan({
          tenantId: lease.tenantId, userId: lease.userId,
          requestId: lease.requestId, now: now(),
        });
        await input.queue.park(lease, {
          findingCodes: scan.findingCodes,
          admissionFenced: scan.admissionFenced,
          retrySeconds: scan.findingCodes.length ? 3600 : 1800,
          now: now(),
        });
        return scan.findingCodes.length ? "held" : "review";
      } catch {
        const retry = Math.min(3600, Math.max(60, 30 * 2 ** Math.min(lease.attempt, 8)));
        await input.queue.fail(lease, retry).catch(() => undefined);
        return "retry";
      }
    },
  };
}
