import { describe,expect,it } from "vitest";
import {
  createPostgresTalkRepository,
  type TalkSqlPool,
} from "./postgres_repository.js";

describe("Talk replay visibility",()=>{
  it("requires a published finalized replay before ended Talks enter Explore",async()=>{
    const calls:Array<{text:string;values?:unknown[]}>= [];
    const pool:TalkSqlPool={
      async query<Row>(text:string,values?:unknown[]){
        calls.push({text,...(values===undefined?{}:{values})});
        return {rowCount:0,rows:[] as unknown as Row[]};
      },
    };
    await createPostgresTalkRepository(pool).listTalks({
      tenantId:"tenant_1",viewerUserId:"viewer_1",feed:"explore",limit:40,
    });
    expect(calls[0]?.text).toContain("recording_state='finalized'");
    expect(calls[0]?.text).toContain("publication_state='published'");
  });

  it("lets only the Host or a public replay resolve an ended Talk detail",async()=>{
    const calls:Array<{text:string;values?:unknown[]}>= [];
    const pool:TalkSqlPool={
      async query<Row>(text:string,values?:unknown[]){
        calls.push({text,...(values===undefined?{}:{values})});
        return {rowCount:0,rows:[] as unknown as Row[]};
      },
    };
    await createPostgresTalkRepository(pool).getTalk({
      tenantId:"tenant_1",talkId:"talk_1",viewerUserId:"viewer_1",
    });
    expect(calls[0]?.text).toContain("host_user_id = $3");
    expect(calls[0]?.text).toContain("publication_state='published'");
    expect(calls[0]?.values).toEqual(["tenant_1","talk_1","viewer_1"]);
  });

  it("blocks comments on private ended Talks for non-Hosts",async()=>{
    const calls:Array<{text:string;values?:unknown[]}>= [];
    const pool:TalkSqlPool={
      async query<Row>(text:string,values?:unknown[]){
        calls.push({text,...(values===undefined?{}:{values})});
        return {rowCount:0,rows:[] as unknown as Row[]};
      },
    };
    await createPostgresTalkRepository(pool).addComment({
      tenantId:"tenant_1",talkId:"talk_1",commentId:"comment_1",
      authorUserId:"viewer_1",authorName:"Viewer",body:"hello",
      createdAt:"2026-10-07T10:10:00.000Z",
    });
    expect(calls[0]?.text).toContain("t.host_user_id = $4");
    expect(calls[0]?.text).toContain("publication_state='published'");
  });
});
