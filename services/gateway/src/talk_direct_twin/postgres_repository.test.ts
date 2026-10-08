import { describe,expect,it } from "vitest";
import {
  createPostgresDirectTwinRepository,
  type DirectTwinSqlPool,
} from "./postgres_repository.js";

describe("Postgres Direct Twin repository",()=>{
  it("resolves Twin owner from canonical persona/public profile projections",async()=>{
    const calls:string[]=[];
    const pool:DirectTwinSqlPool={
      async query<Row>(text:string){
        calls.push(text);
        return {
          rowCount:1,
          rows:[{
            tenant_id:"tenant-1",talk_id:"talk-1",seat_id:"seat-1",
            persona_id:"twin-1",kind:"twin",owner_user_id:"owner-1",
            admitted:true,removed:false,
          }] as unknown as Row[],
        };
      },
    };
    const result=await createPostgresDirectTwinRepository(pool).readSeat({
      tenantId:"tenant-1",talkId:"talk-1",seatId:"seat-1",
    });
    expect(result).toMatchObject({personaId:"twin-1",ownerUserId:"owner-1",kind:"twin"});
    expect(calls[0]).toContain("talks.persona_profiles");
    expect(calls[0]).toContain("talks.public_profiles");
  });

  it("lists only active Twin Seats owned by the current user",async()=>{
    let call:{text:string;values?:unknown[] | undefined}|undefined;
    const pool:DirectTwinSqlPool={
      async query<Row>(text:string,values?:unknown[] | undefined){
        call={text,values};
        return {rowCount:1,rows:[{
          tenant_id:"tenant-1",talk_id:"talk-1",seat_id:"seat-1",
          persona_id:"twin-1",kind:"twin",owner_user_id:"owner-1",
          admitted:true,removed:false,
        }] as unknown as Row[]};
      },
    };
    const result=await createPostgresDirectTwinRepository(pool).listOwnedTwinSeats({
      tenantId:"tenant-1",talkId:"talk-1",ownerUserId:"owner-1",
    });
    expect(result).toHaveLength(1);
    expect(call?.text).toContain("s.kind = 'twin'");
    expect(call?.text).toContain("s.active = TRUE");
    expect(call?.values).toEqual(["tenant-1","talk-1","owner-1"]);
  });

  it("uses compare-and-swap revision when replacing an instruction",async()=>{
    let call:{text:string;values?:unknown[] | undefined}|undefined;
    const pool:DirectTwinSqlPool={
      async query<Row>(text:string,values?:unknown[] | undefined){
        call={text,values};
        return {
          rowCount:1,
          rows:[{
            tenant_id:"tenant-1",talk_id:"talk-1",seat_id:"seat-1",persona_id:"twin-1",
            owner_user_id:"owner-1",revision:4,instruction:"Be concise",
            updated_at:"2026-10-07T10:00:00Z",expires_at:"2026-10-07T10:01:00Z",
          }] as unknown as Row[],
        };
      },
    };
    const saved=await createPostgresDirectTwinRepository(pool).writeInstruction({
      tenantId:"tenant-1",talkId:"talk-1",seatId:"seat-1",personaId:"twin-1",
      ownerUserId:"owner-1",expectedRevision:3,instruction:"Be concise",
      updatedAt:"2026-10-07T10:00:00Z",expiresAt:"2026-10-07T10:01:00Z",
    });
    expect(saved.revision).toBe(4);
    expect(call?.text).toContain("revision=talks.direct_twin_instructions.revision+1");
    expect(call?.text).toContain("WHERE talks.direct_twin_instructions.revision=$6");
    expect(call?.values?.[5]).toBe(3);
  });

  it("fails closed when CAS write applies no row",async()=>{
    const pool:DirectTwinSqlPool={
      async query<Row>() { return {rowCount:0,rows:[] as Row[]}; },
    };
    await expect(createPostgresDirectTwinRepository(pool).writeInstruction({
      tenantId:"tenant-1",talkId:"talk-1",seatId:"seat-1",personaId:"twin-1",
      ownerUserId:"owner-1",expectedRevision:2,instruction:"x",
      updatedAt:"2026-10-07T10:00:00Z",expiresAt:"2026-10-07T10:01:00Z",
    })).rejects.toThrow("revision conflict");
  });
});

