
import { describe, expect, it, vi } from "vitest";
import { createPostgresSupportQueue, createSupportStaffService } from "./operator.js";
import type { SupportStaffAuthorizer } from "./operator.js";

describe("U29 privileged support workflow",()=>{
  const staff:SupportStaffAuthorizer={async authorize({authorizationHeader}){
    if(authorizationHeader!=="Bearer privileged")throw new Error("forbidden");
    return {tenantId:"TENANT",actorId:"STAFF"};
  }};
  it("does not accept public customer bearer, invalid transitions or invented refund",async()=>{
    const queue=vi.fn(async()=>[]);
    const transition=vi.fn(async()=>null);
    const service=createSupportStaffService({authorizer:staff,repository:{queue,transition}});
    await expect(service.queue({authorizationHeader:"Bearer customer",limit:30})).rejects.toThrow("forbidden");
    expect(queue).not.toHaveBeenCalled();
    await expect(service.transition({authorizationHeader:"Bearer privileged",ticketId:"123e4567-e89b-42d3-a456-426614174000",expectedStatus:"queued",nextStatus:"resolved",resolution:"Refund is complete."})).rejects.toMatchObject({code:"INVALID_SUPPORT_TRANSITION"});
    await expect(service.transition({authorizationHeader:"Bearer privileged",ticketId:"123e4567-e89b-42d3-a456-426614174000",expectedStatus:"reviewing",nextStatus:"resolved"})).rejects.toMatchObject({code:"SUPPORT_RESOLUTION_REQUIRED"});
    expect(transition).not.toHaveBeenCalled();
  });
  it("writes audit and compare-and-set status as a single SQL statement",async()=>{
    const statements:Array<{sql:string;values:readonly unknown[]|undefined}>=[];
    const pg=createPostgresSupportQueue({async query<Row>(sql:string,values?:readonly unknown[]){
      statements.push({sql,values});return {rowCount:0,rows:[] as Row[]};
    }});
    const result=await pg.transition({
      tenantId:"TENANT",actorId:"STAFF",ticketId:"123e4567-e89b-42d3-a456-426614174000",
      expectedStatus:"queued",nextStatus:"reviewing",resolution:null,
    });
    expect(result).toBeNull();
    expect(statements[0]?.sql).toContain("WHERE tenant_id=$1 AND id=$2::uuid AND status=$3");
    expect(statements[0]?.sql).toContain("INSERT INTO support.ticket_events");
    expect(statements[0]?.values?.slice(0,5)).toEqual(["TENANT","123e4567-e89b-42d3-a456-426614174000","queued","reviewing","STAFF"]);
  });
});

