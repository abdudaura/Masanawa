import type { TeacherQueue } from "@masanawa/rooms";
import { createRoomTeacherWorker } from "./teacher.js";

/**
 * A bounded review-only fallback for free Room questions. Uses the canonical
 * PostgreSQL events.outbox queue and its fencing/ACK/retry authority. The
 * teacher worker writes a staff-review question, never publishes an AI answer.
 * Paid, Play, external messaging and generation providers are untouched.
 */
export function createRoomTeacherReviewRuntime(input: {
  readonly queue: TeacherQueue;
  readonly workerId: string;
  readonly enabled: () => boolean;
  readonly intervalMs?: number;
  readonly onError?: (error: unknown) => void;
}) {
  const delay = input.intervalMs ?? 5000;
  if (!Number.isSafeInteger(delay) || delay < 1000 || delay > 60000) {
    throw new RangeError("rooms_review_interval_invalid");
  }
  const worker = createRoomTeacherWorker(
    input.queue, {generate: async () => null}, input.workerId,
    input.enabled,
  );
  let current: ReturnType<typeof worker.tick> | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  async function tick(): Promise<"disabled"|"busy"|"idle"|"processed"|"retry"> {
    if (stopped || !input.enabled()) return "disabled";
    // Never issue two concurrent claims from the same scheduler tick.
    if (current) return "busy";
    const work = worker.tick();
    current = work;
    try {
      return await work;
    } finally {
      if (current === work) current = undefined;
    }
  }

  return Object.freeze({
    tick,
    start(): void {
      if (interval || stopped || !input.enabled()) return;
      interval = setInterval(() => {
        void tick().catch(error => input.onError?.(error));
      }, delay);
      interval.unref?.();
    },
    async stop(): Promise<void> {
      stopped = true;
      if (interval) clearInterval(interval);
      interval = undefined;
      // Shutdown must not close the PG pool beneath a claimed question.
      await current?.catch(() => undefined);
    },
  });
}
