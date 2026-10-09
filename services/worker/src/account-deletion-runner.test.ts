import { describe,expect,it,vi } from "vitest";
import type { DeletionJobLease, AccountDeletionFinancialScreen } from "@masanawa/postgres";
import { createAccountDeletionRunner } from "./account-deletion-runner.js";

const lease:DeletionJobLease={
  requestId:"request-1",tenantId:"tenant-1",userId:"user-1",
  token:"lease-1",attempt:1,
};
const fixedNow="2026-10-08T06:10:00.000Z";

function harness(findings:readonly string[]=[],fail=false) {
  const claim=vi.fn(async()=>lease as DeletionJobLease|null);
  const park=vi.fn(async()=>undefined);
  const retry=vi.fn(async()=>undefined);
  const scan=vi.fn(async():Promise<AccountDeletionFinancialScreen>=>{
    if(fail)throw new Error("provider-check-unavailable");
    return {
      scanId:"scan-1",checkedAt:fixedNow,
      findingCodes:findings,admissionFenced:false,clear:false,
    };
  });
  const runner=createAccountDeletionRunner({
    queue:{claim,park,fail:retry},financial:{scan},now:()=>fixedNow,
  });
  return {runner,claim,park,retry,scan};
}

describe("R12 deletion reconciliation scheduling",()=>{
  it("does not invent work when there is no verified request",async()=>{
    const h=harness();
    h.claim.mockResolvedValueOnce(null);
    expect(await h.runner.runOnce()).toBe("idle");
    expect(h.scan).not.toHaveBeenCalled();
    expect(h.park).not.toHaveBeenCalled();
  });
  it("parks financial exposure for delayed review",async()=>{
    const h=harness(["crypto-intent","ngn-wallet"]);
    expect(await h.runner.runOnce()).toBe("held");
    expect(h.park).toHaveBeenCalledWith(lease,{
      findingCodes:["crypto-intent","ngn-wallet"],
      admissionFenced:false,retrySeconds:3600,now:fixedNow,
    });
    expect(h.retry).not.toHaveBeenCalled();
  });
  it("requires review even when there is no financial history",async()=>{
    const h=harness();
    expect(await h.runner.runOnce()).toBe("review");
    expect(h.park).toHaveBeenCalledWith(lease,{
      findingCodes:[],admissionFenced:false,retrySeconds:1800,now:fixedNow,
    });
  });
  it("recovers from a failing financial dependency by retrying",async()=>{
    const h=harness([],true);
    expect(await h.runner.runOnce()).toBe("retry");
    expect(h.park).not.toHaveBeenCalled();
    expect(h.retry).toHaveBeenCalledWith(lease,60);
  });
  it("also retries if durable park itself fails",async()=>{
    const h=harness();
    h.park.mockRejectedValueOnce(new Error("database outage"));
    expect(await h.runner.runOnce()).toBe("retry");
    expect(h.retry).toHaveBeenCalledTimes(1);
  });
});
