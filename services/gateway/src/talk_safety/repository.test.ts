import { describe,expect,it } from "vitest";
import {
  createPostgresTalkSafetyRepository,
  type TalkSafetySqlPool,
} from "./repository.js";

describe("Postgres Talk safety repository",()=>{
  it("uses reporter + client request identity for idempotent reports",async()=>{
    let call:{text:string;values?:unknown[]}|undefined;
    const pool:TalkSafetySqlPool={
      async query<Row>(text:string,values?:unknown[]){
        call={ text, ...(values === undefined ? {} : { values }) };
        return {
          rowCount:1,
          rows:[{
            tenant_id:"tenant-1",report_id:"report-1",reporter_user_id:"user-1",
            target_kind:"talk",target_id:"talk-1",reason:"spam",detail:null,
            client_request_id:"client-1",created_at:"2026-10-07T10:00:00Z",
          }] as unknown as Row[],
        };
      },
    };
    const saved=await createPostgresTalkSafetyRepository(pool).appendReport({
      schemaVersion:1,reportId:"report-new",tenantId:"tenant-1",reporterUserId:"user-1",
      target:{kind:"talk",id:"talk-1"},reason:"spam",detail:null,
      clientRequestId:"client-1",createdAt:"2026-10-07T10:00:00Z",
    });
    expect(saved.reportId).toBe("report-1");
    expect(call?.text).toContain("ON CONFLICT(tenant_id,reporter_user_id,client_request_id)");
  });

  it("verifies a user-id safety subject through public profiles",async()=>{
    let call:{text:string;values?:unknown[]}|undefined;
    const pool:TalkSafetySqlPool={
      async query<Row>(text:string,values?:unknown[]){
        call={ text, ...(values === undefined ? {} : { values }) };
        return {
          rowCount:1,
          rows:[{user_id:"user-host"}] as unknown as Row[],
        };
      },
    };
    const repository=createPostgresTalkSafetyRepository(pool);
    await expect(repository.resolveProfileUserById({
      tenantId:"tenant-1",
      userId:"user-host",
    })).resolves.toBe("user-host");
    expect(call?.text).toContain("FROM talks.public_profiles");
    expect(call?.text).toContain("user_id=$2");
    expect(call?.values).toEqual(["tenant-1","user-host"]);
  });

  it("CAS-updates enforcement by current revision",async()=>{
    let call:{text:string;values?:unknown[]}|undefined;
    const pool:TalkSafetySqlPool={
      async query<Row>(text:string,values?:unknown[]){
        call={ text, ...(values === undefined ? {} : { values }) };
        return {
          rowCount:1,
          rows:[{
            tenant_id:"tenant-1",target_kind:"replay",target_id:"replay-1",
            revision:2,visibility:"blocked",reason_code:"policy.abuse",
            updated_at:"2026-10-07T10:01:00Z",
          }] as unknown as Row[],
        };
      },
    };
    const repository=createPostgresTalkSafetyRepository(pool);
    const saved=await repository.writeEnforcement({
      current:{
        schemaVersion:1,tenantId:"tenant-1",target:{kind:"replay",id:"replay-1"},
        revision:1,visibility:"restricted",reasonCode:"review.pending",
        updatedAt:"2026-10-07T10:00:00Z",
      },
      next:{
        schemaVersion:1,tenantId:"tenant-1",target:{kind:"replay",id:"replay-1"},
        revision:2,visibility:"blocked",reasonCode:"policy.abuse",
        updatedAt:"2026-10-07T10:01:00Z",
      },
    });
    expect(saved.revision).toBe(2);
    expect(call?.text).toContain("AND revision=$4");
    expect(call?.values?.[3]).toBe(1);
  });

  it("fails closed when enforcement revision does not apply",async()=>{
    const pool:TalkSafetySqlPool={
      async query<Row>() { return {rowCount:0,rows:[] as Row[]}; },
    };
    const repository=createPostgresTalkSafetyRepository(pool);
    await expect(repository.writeEnforcement({
      current:{
        schemaVersion:1,tenantId:"tenant-1",target:{kind:"talk",id:"talk-1"},
        revision:2,visibility:"restricted",reasonCode:"review.pending",
        updatedAt:"2026-10-07T10:00:00Z",
      },
      next:{
        schemaVersion:1,tenantId:"tenant-1",target:{kind:"talk",id:"talk-1"},
        revision:3,visibility:"blocked",reasonCode:"policy.abuse",
        updatedAt:"2026-10-07T10:01:00Z",
      },
    })).rejects.toThrow("revision conflict");
  });
});
