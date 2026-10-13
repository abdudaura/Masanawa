import { afterEach, describe, expect, it, vi } from "vitest";
import type { TeacherJob, TeacherQueue } from "@masanawa/rooms";
import { createRoomTeacherReviewRuntime } from "./runtime.js";

const job: TeacherJob = {
  outboxId: "outbox-event_1", tenantId: "tenant_1",
  roomId: "room_1", questionId: "room-question_1", fence: 2,
};
const loops: Array<ReturnType<typeof createRoomTeacherReviewRuntime>> = [];
afterEach(async () => {
  await Promise.all(loops.splice(0).map(r => r.stop()));
  vi.useRealTimers();
});
function createLoop(queue: TeacherQueue, enabled = () => true, intervalMs = 1000) {
  const loop = createRoomTeacherReviewRuntime({
    queue, workerId: "review-worker-1", enabled, intervalMs,
  });
  loops.push(loop);
  return loop;
}
describe("Rooms review-only scheduled worker", () => {
  it("does not claim or mutate the canonical queue when disabled", async () => {
    const queue = {claim: vi.fn(), draft: vi.fn(), fail: vi.fn()};
    const loop = createLoop(queue, () => false);
    expect(await loop.tick()).toBe("disabled");
    loop.start();
    expect(queue.claim).not.toHaveBeenCalled();
    expect(queue.draft).not.toHaveBeenCalled();
  });

  it("takes one canonical outbox claim to staff review, never auto-publishes", async () => {
    const queue = {
      claim: vi.fn(async () => job),
      draft: vi.fn(async () => undefined),
      fail: vi.fn(async () => undefined),
    };
    const loop = createLoop(queue);
    expect(await loop.tick()).toBe("processed");
    expect(queue.claim).toHaveBeenCalledWith("review-worker-1");
    expect(queue.draft).toHaveBeenCalledWith(job, null);
    expect(queue.fail).not.toHaveBeenCalled();
  });

  it("does not race concurrent ticks while another lease is in flight", async () => {
    let release: (() => void) | undefined;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const queue = {
      claim: vi.fn(async () => { await blocked; return job; }),
      draft: vi.fn(async () => undefined),
      fail: vi.fn(async () => undefined),
    };
    const loop = createLoop(queue);
    const first = loop.tick();
    expect(await loop.tick()).toBe("busy");
    expect(queue.claim).toHaveBeenCalledTimes(1);
    release?.();
    expect(await first).toBe("processed");
    expect(queue.draft).toHaveBeenCalledTimes(1);
  });

  it("returns failed claims to the same retry queue and preserves identifiers", async () => {
    const queue = {
      claim: vi.fn(async () => job),
      draft: vi.fn(async () => { throw new Error("db_unavailable"); }),
      fail: vi.fn(async () => undefined),
    };
    const loop = createLoop(queue);
    expect(await loop.tick()).toBe("retry");
    expect(queue.fail).toHaveBeenCalledWith(job, "temporary_failure");
  });

  it("awaits an in-flight claim during shutdown and does not claim afterward", async () => {
    let release: (() => void) | undefined;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const queue = {
      claim: vi.fn(async () => { await blocked; return job; }),
      draft: vi.fn(async () => undefined),
      fail: vi.fn(async () => undefined),
    };
    const loop = createLoop(queue);
    const work = loop.tick();
    const stopping = loop.stop();
    expect(await loop.tick()).toBe("disabled");
    release?.();
    await stopping;
    expect(await work).toBe("processed");
    expect(queue.claim).toHaveBeenCalledTimes(1);
  });

  it("schedules bounded ticks only while enabled and stops timer on drain", async () => {
    vi.useFakeTimers();
    let allowed = true;
    const queue = {
      claim: vi.fn(async () => null),
      draft: vi.fn(async () => undefined),
      fail: vi.fn(async () => undefined),
    };
    const loop = createLoop(queue, () => allowed);
    loop.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(queue.claim).toHaveBeenCalledTimes(1);
    allowed = false;
    await vi.advanceTimersByTimeAsync(1000);
    expect(queue.claim).toHaveBeenCalledTimes(1);
    await loop.stop();
    allowed = true;
    await vi.advanceTimersByTimeAsync(2000);
    expect(queue.claim).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid scheduling intervals rather than hot-looping Postgres", () => {
    const queue = { claim: vi.fn(), draft: vi.fn(), fail: vi.fn() };
    expect(() => createRoomTeacherReviewRuntime({
      queue, workerId: "worker", enabled: () => true, intervalMs: 0,
    })).toThrow("rooms_review_interval_invalid");
  });
});
