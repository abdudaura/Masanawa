import { describe, it, expect } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import {
  OperatorTaskError,
  createOperatorTaskService,
  type OperatorActor,
  type OperatorDomainOutcome,
  type OperatorTaskEvent,
  type OperatorTaskPhase,
  type OperatorTaskRecord,
  type OperatorTaskRepository,
} from "./index.js";
import { createHash } from "node:crypto";

function actor(): OperatorActor {
  return { tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user"), sessionDigest: "a".repeat(64) };
}
function memory() {
  const tasks = new Map<string, OperatorTaskRecord>();
  const events = new Map<string, OperatorTaskEvent[]>();
  const ownerKey = (a: OperatorActor, taskId: string) => [a.tenantId,a.userId,taskId].join("|");
  const repository: OperatorTaskRepository = {
    async createOrRead({ actor: a, task }) {
      const other = [...tasks.values()].find(t => t.tenantId === a.tenantId &&
        t.userId === a.userId && t.requestId === task.requestId);
      if (other) return other;
      tasks.set(ownerKey(a,task.taskId),task);
      events.set(ownerKey(a,task.taskId),[{taskId:task.taskId,version:1,phase:"proposed",at:task.createdAt,code:null}]);
      return task;
    },
    async read({actor: a,taskId}) { return tasks.get(ownerKey(a,taskId)) ?? null; },
    async list({actor: a,limit,before}) {
      const rows = [...tasks.values()].filter(t=>t.tenantId===a.tenantId&&t.userId===a.userId)
        .sort((x,y)=>y.createdAt.localeCompare(x.createdAt)||y.taskId.localeCompare(x.taskId));
      const idx = before ? rows.findIndex(x=>x.taskId===before) : -1;
      return rows.slice(before ? idx < 0 ? rows.length : idx+1 : 0, before ? idx < 0 ? rows.length : idx+1+limit : limit);
    },
    async events({actor: a,taskId,afterVersion,limit}) {
      return (events.get(ownerKey(a,taskId)) ?? []).filter(e=>e.version>afterVersion).slice(0,limit);
    },
    async change({actor: a,taskId,expectedVersion,allowedFrom,patch,at}) {
      const k=ownerKey(a,taskId);
      const old=tasks.get(k);
      if (!old) throw new OperatorTaskError("TASK_NOT_FOUND",404);
      if (old.version!==expectedVersion || !allowedFrom.includes(old.phase)) {
        throw new OperatorTaskError("TASK_REVISION_CONFLICT",409);
      }
      const next: OperatorTaskRecord={...old,...patch,version:old.version+1,updatedAt:at};
      tasks.set(k,next);
      events.get(k)!.push({
        taskId,version:next.version,phase:next.phase as OperatorTaskPhase,at,
        code:next.errorCode,
      });
      return next;
    },
  };
  return { repository,tasks,events };
}
function fixture() {
  const account=actor(), store=memory();
  let time="2026-10-09T00:00:00.000Z";
  let executes=0;
  let readback: OperatorDomainOutcome={status:"unknown"};
  let executed: OperatorDomainOutcome={status:"confirmed",receiptRef:"fabricated_not_evidence"};
  let admissionDenied=false;
  let authorizationHook: (() => void | Promise<void>) | null = null;
  const service=createOperatorTaskService({
    repository:store.repository,
    domain: {
      async admit() {
        if(admissionDenied) throw new OperatorTaskError("CAPABILITY_NOT_QUALIFIED",403);
      },
      async authorizeConfirmation() {
        if(admissionDenied) throw new OperatorTaskError("CAPABILITY_REVOKED",403);
        if (authorizationHook) await authorizationHook();
      },
      async execute() { executes++; return executed; },
      async reconcile() { return readback; },
    },
    now:()=>time,
  });
  const propose=(requestId="retry-key", arguments_: Readonly<Record<string, unknown>>={target:"safe"})=>service.propose({
    actor:account,requestId,scope:"private-assistant",capabilityId:"talks.create",
    capabilityVersion:1,arguments:arguments_,
  });
  const prepare=async (taskId:string,version:number) => service.prepare({
    actor:account,taskId,expectedVersion:version,operationClass:"send",
    termsDigest:createHash("sha256").update("canonical server-reviewed terms").digest("hex"),
    approvalExpiresAt:"2026-10-09T00:05:00.000Z",
  });
  return {
    service,account,store,propose,prepare,
    setNow(v:string) {time=v;},
    setReadback(v:OperatorDomainOutcome) {readback=v;},
    setExecuted(v:OperatorDomainOutcome) {executed=v;},
    denyAdmission() {admissionDenied=true;},
    onAuthorize(hook: () => void | Promise<void>) {authorizationHook=hook;},
    executions() {return executes;},
  };
}

describe("U02 durable operator task state/security contract", () => {
  it("deduplicates the same request, rejects conflicting retries and never stores raw arguments", async () => {
    const f=fixture();
    const first=await f.propose();
    const retry=await f.propose();
    expect(first.taskId).toBe(retry.taskId);
    expect(f.store.tasks.size).toBe(1);
    expect(JSON.stringify(first)).not.toContain("safe");
    await expect(f.propose("retry-key",{target:"different"})).rejects.toMatchObject({code:"TASK_REQUEST_REPLAY_CONFLICT"});
    expect((await f.service.events({actor:f.account,taskId:first.taskId}))).toHaveLength(1);
  });

  it("fences inaccessible cross-account records, including event history", async () => {
    const f=fixture(), first=await f.propose(), imposter=actor();
    await expect(f.service.read({actor:imposter,taskId:first.taskId})).rejects.toMatchObject({statusCode:404});
    await expect(f.service.events({actor:imposter,taskId:first.taskId})).rejects.toMatchObject({statusCode:404});
    expect(await f.service.list({actor:imposter})).toEqual([]);
  });

  it("rejects unqualified capabilities before inserting a task", async () => {
    const f=fixture();f.denyAdmission();
    await expect(f.propose()).rejects.toMatchObject({code:"CAPABILITY_NOT_QUALIFIED"});
    expect(f.store.tasks.size).toBe(0);
  });

  it("rejects malformed proposals and hostile nested values", async () => {
    const f=fixture();
    await expect(f.propose("bad",{"nested":Array(65).fill("x")})).rejects.toMatchObject({statusCode:400});
    await expect(f.service.propose({
      actor:f.account,requestId:"badkey",scope:"public-talk" as never,
      capabilityId:"execute_code",capabilityVersion:0,arguments:{},
    })).rejects.toMatchObject({statusCode:400});
  });

  it("never exposes token digests in read/list and enforces reviewed approval", async () => {
    const f=fixture(), task=await f.propose(), p=await f.prepare(task.taskId,task.version);
    const read=await f.service.read({actor:f.account,taskId:task.taskId});
    expect(read).not.toHaveProperty("approvalDigest");
    expect(read).not.toHaveProperty("argumentDigest");
    expect(read.phase).toBe("awaiting_approval");
    await expect(f.service.confirm({actor:f.account,taskId:task.taskId,
      expectedVersion:p.task.version,approvalToken:"yes"})).rejects.toMatchObject({code:"TASK_APPROVAL_INVALID"});
    expect(f.executions()).toBe(0);
  });

  it("requires same valid access session, approval revision and expiry", async () => {
    const f=fixture(), task=await f.propose(), p=await f.prepare(task.taskId,task.version);
    const changed:OperatorActor={...f.account,sessionDigest:"c".repeat(64)};
    await expect(f.service.confirm({actor:changed,taskId:task.taskId,
      expectedVersion:p.task.version,approvalToken:p.approvalToken})).rejects.toMatchObject({statusCode:403});
    f.setNow("2026-10-09T00:06:00.000Z");
    await expect(f.service.confirm({actor:f.account,taskId:task.taskId,
      expectedVersion:p.task.version,approvalToken:p.approvalToken})).rejects.toMatchObject({statusCode:403});
    expect(f.executions()).toBe(0);
  });

  it("rejects approval that expires while the trusted authorization call is pending", async () => {
    const f=fixture(), proposed=await f.propose();
    const prepared=await f.prepare(proposed.taskId,proposed.version);
    f.onAuthorize(async () => { f.setNow("2026-10-09T00:05:00.000Z"); });
    await expect(f.service.confirm({
      actor:f.account,taskId:proposed.taskId,expectedVersion:prepared.task.version,
      approvalToken:prepared.approvalToken,
    })).rejects.toMatchObject({code:"TASK_APPROVAL_INVALID",statusCode:403});
    expect(f.executions()).toBe(0);
    const persisted=await f.service.read({actor:f.account,taskId:proposed.taskId});
    expect(persisted.phase).toBe("awaiting_approval");
    expect(persisted.version).toBe(prepared.task.version);
    expect((await f.service.events({actor:f.account,taskId:proposed.taskId})).map(e=>e.phase))
      .toEqual(["proposed","awaiting_approval"]);
  });

  it("allows a checked authorization completed just before expiry", async () => {
    const f=fixture(), proposed=await f.propose();
    const prepared=await f.prepare(proposed.taskId,proposed.version);
    f.onAuthorize(async () => { f.setNow("2026-10-09T00:04:59.999Z"); });
    const result=await f.service.confirm({
      actor:f.account,taskId:proposed.taskId,expectedVersion:prepared.task.version,
      approvalToken:prepared.approvalToken,
    });
    expect(result.phase).toBe("reconciling");
    expect(f.executions()).toBe(1);
  });

  it("does not promote an execution acknowledgement to verified success", async () => {
    const f=fixture(), task=await f.propose(), p=await f.prepare(task.taskId,task.version);
    const unknown=await f.service.confirm({actor:f.account,taskId:task.taskId,
      expectedVersion:p.task.version,approvalToken:p.approvalToken});
    expect(unknown.phase).toBe("reconciling");
    expect(unknown.receiptRef).toBeNull();
    expect(f.executions()).toBe(1);
    await expect(f.service.confirm({actor:f.account,taskId:task.taskId,
      expectedVersion:p.task.version,approvalToken:p.approvalToken})).rejects.toMatchObject({statusCode:409});
    f.setReadback({status:"confirmed",receiptRef:"talk:receipt-123"});
    const final=await f.service.reconcile({actor:f.account,taskId:task.taskId});
    expect(final.phase).toBe("succeeded");
    expect(final.receiptRef).toBe("talk:receipt-123");
    expect(f.executions()).toBe(1);
    expect((await f.service.events({actor:f.account,taskId:task.taskId})).map(e=>e.phase))
      .toEqual(["proposed","awaiting_approval","running","reconciling","succeeded"]);
  });

  it("does not accept invalid final receipts and never replays an unknown operation", async () => {
    const f=fixture(), task=await f.propose(), p=await f.prepare(task.taskId,task.version);
    f.setReadback({status:"confirmed",receiptRef:""});
    const unknown=await f.service.confirm({actor:f.account,taskId:task.taskId,
      expectedVersion:p.task.version,approvalToken:p.approvalToken});
    expect(unknown.phase).toBe("reconciling");
    f.setReadback({status:"unknown"});
    await f.service.reconcile({actor:f.account,taskId:task.taskId});
    expect(f.executions()).toBe(1);
  });

  it("allows cancellation only before admitted execution, with revision fencing", async () => {
    const f=fixture(), task=await f.propose();
    await expect(f.service.cancel({actor:f.account,taskId:task.taskId,expectedVersion:2}))
      .rejects.toMatchObject({statusCode:409});
    const p=await f.prepare(task.taskId,task.version);
    const cancelled=await f.service.cancel({actor:f.account,taskId:task.taskId,expectedVersion:p.task.version});
    expect(cancelled.phase).toBe("cancelled");
    await expect(f.service.confirm({actor:f.account,taskId:task.taskId,
      expectedVersion:p.task.version,approvalToken:p.approvalToken})).rejects.toMatchObject({statusCode:409});
  });

  it("rechecks permission at approval and refuses revoked actions", async () => {
    const f=fixture(), task=await f.propose(), p=await f.prepare(task.taskId,task.version);
    f.denyAdmission();
    await expect(f.service.confirm({actor:f.account,taskId:task.taskId,
      expectedVersion:p.task.version,approvalToken:p.approvalToken})).rejects.toMatchObject({code:"CAPABILITY_REVOKED"});
    expect(f.executions()).toBe(0);
  });

  it("rotates lost approval tokens and rejects the old revision", async () => {
    const f=fixture(), task=await f.propose(), first=await f.prepare(task.taskId,task.version);
    const next=await f.prepare(task.taskId,first.task.version);
    await expect(f.service.confirm({actor:f.account,taskId:task.taskId,
      expectedVersion:next.task.version,approvalToken:first.approvalToken})).rejects.toMatchObject({statusCode:403});
    expect(next.task.operationId).not.toBe(first.task.operationId);
  });

    it("paginates task events in version order and refuses invalid cursors", async () => {
    const f=fixture(), task=await f.propose();
    await f.prepare(task.taskId,task.version);
    const events=await f.service.events({actor:f.account,taskId:task.taskId,afterVersion:1,limit:10});
    expect(events.map(e=>e.version)).toEqual([2]);
    await expect(f.service.events({actor:f.account,taskId:task.taskId,afterVersion:-1}))
      .rejects.toMatchObject({statusCode:400});
  });

  it("returns committed worker receipt after a same-operation settlement race", async () => {
    const f = fixture(), proposed = await f.propose();
    const prepared = await f.prepare(proposed.taskId, proposed.version);
    f.setReadback({ status: "confirmed", receiptRef: "talk:late-request" });
    const change = f.store.repository.change;
    let concurrent = 0;
    f.store.repository.change = async input => {
      if (input.patch.phase === "succeeded" && concurrent++ === 0) {
        const key = [...f.store.tasks.keys()][0]!;
        const current = f.store.tasks.get(key)!;
        // Simulate the canonical PostgreSQL CAS winning on another worker.
        f.store.tasks.set(key, {
          ...current, phase: "succeeded", receiptRef: "talk:durable-worker",
          version: current.version + 1,
        });
        throw new OperatorTaskError("TASK_REVISION_CONFLICT", 409);
      }
      return change(input);
    };
    const result = await f.service.confirm({
      actor: f.account, taskId: proposed.taskId,
      expectedVersion: prepared.task.version, approvalToken: prepared.approvalToken,
    });
    expect(result.phase).toBe("succeeded");
    expect(result.receiptRef).toBe("talk:durable-worker");
    expect(result.receiptRef).not.toBe("talk:late-request");
    expect(f.executions()).toBe(1);
  });

  it("refuses a status race from a different operation and never reruns execution", async () => {
    const f = fixture(), proposed = await f.propose();
    const prepared = await f.prepare(proposed.taskId, proposed.version);
    const running = await f.service.confirm({
      actor: f.account, taskId: proposed.taskId,
      expectedVersion: prepared.task.version, approvalToken: prepared.approvalToken,
    });
    f.setReadback({ status: "confirmed", receiptRef: "talk:untrusted-response" });
    const change = f.store.repository.change;
    f.store.repository.change = async input => {
      if (input.patch.phase === "succeeded") {
        const key = [...f.store.tasks.keys()][0]!;
        const previous = f.store.tasks.get(key)!;
        f.store.tasks.set(key, {
          ...previous, operationId: "operation_different", version: previous.version + 1,
        });
        throw new OperatorTaskError("TASK_REVISION_CONFLICT", 409);
      }
      return change(input);
    };
    await expect(f.service.reconcile({ actor: f.account, taskId: running.taskId }))
      .rejects.toMatchObject({ code: "TASK_REVISION_CONFLICT", statusCode: 409 });
    expect(f.executions()).toBe(1);
    expect((await f.service.read({ actor: f.account, taskId: running.taskId })).receiptRef).toBeNull();
  });

  it("does not conceal real persistence failures as successful status readbacks", async () => {
    const f = fixture(), proposed = await f.propose();
    const prepared = await f.prepare(proposed.taskId, proposed.version);
    const change = f.store.repository.change;
    f.store.repository.change = async input => {
      if (input.patch.phase === "reconciling") {
        throw new OperatorTaskError("TASK_PERSISTENCE_UNAVAILABLE", 503);
      }
      return change(input);
    };
    await expect(f.service.confirm({
      actor: f.account, taskId: proposed.taskId,
      expectedVersion: prepared.task.version, approvalToken: prepared.approvalToken,
    })).rejects.toMatchObject({ code: "TASK_PERSISTENCE_UNAVAILABLE", statusCode: 503 });
    expect(f.executions()).toBe(1);
  });

});
