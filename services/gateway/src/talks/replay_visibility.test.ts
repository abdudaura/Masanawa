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
      tenantId:"tenant_1",feed:"explore",limit:40,
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

  it("filters safety-restricted replay recordings before ranking public ended Talks", async () => {
    let sql="";
    const pool:TalkSqlPool={
      async query<Row>(text:string) {
        sql=text;
        return {rowCount:0,rows:[] as unknown as Row[]};
      },
    };
    await createPostgresTalkRepository(pool).listTalks({
      tenantId:"tenant_1",viewerUserId:"viewer_1",feed:"explore",limit:40,
    });
    expect(sql).toContain("replay_se.target_kind='replay'");
    expect(sql).toContain("replay_se.target_id=r.recording_id");
    expect(sql).toContain("replay_se.visibility IN ('restricted','blocked')");
    expect(sql.indexOf("replay_se.visibility")).toBeLessThan(sql.indexOf("ORDER BY CASE"));
  });

  it("keeps Host private detail access while requiring a safety-visible recording for viewers", async () => {
    let sql="";
    const pool:TalkSqlPool={
      async query<Row>(text:string) {
        sql=text;
        return {rowCount:0,rows:[] as unknown as Row[]};
      },
    };
    await createPostgresTalkRepository(pool).getTalk({
      tenantId:"tenant_1",talkId:"talk_1",viewerUserId:"viewer_1",
    });
    expect(sql).toContain("t.host_user_id = $3");
    expect(sql).toContain("replay_se.target_kind='replay'");
    expect(sql).toContain("replay_se.target_id=r.recording_id");
    expect(sql).toContain("replay_se.visibility IN ('restricted','blocked')");
  });

  it("rejects new public comments on restricted replays even when the author is the Host", async () => {
    let sql="";
    const pool:TalkSqlPool={
      async query<Row>(text:string) {
        sql=text;
        return {rowCount:0,rows:[] as unknown as Row[]};
      },
    };
    await createPostgresTalkRepository(pool).addComment({
      tenantId:"tenant_1",talkId:"talk_1",commentId:"comment_2",
      authorUserId:"host_1",authorName:"Host",body:"no disclosure",
      createdAt:"2026-10-08T06:00:00.000Z",
    });
    expect(sql).toContain("t.state <> 'ended' OR NOT EXISTS");
    expect(sql).toContain("hidden_se.target_id=hidden_r.recording_id");
    expect(sql).toContain("hidden_se.visibility IN ('restricted','blocked')");
    expect(sql).toContain("replay_se.target_id=r.recording_id");
  });
});
