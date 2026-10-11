import {describe,expect,it,vi} from "vitest";
import type {Pool} from "@masanawa/postgres";
import {createPostgresYouTubeCatalogSink} from "./postgres_catalog.js";

const video={
  tenantId:"tenant-1",sourceId:"source-1",provider:"youtube" as const,
  providerVideoId:"abcdefghijk",sourceUrl:"https://www.youtube.com/watch?v=abcdefghijk",
  title:"Original",channelName:"Publisher",
};
function fakePool(authorized:boolean,inserted:boolean) {
  const queries:string[]=[];
  const client={
    query:vi.fn(async(sql:string)=>{
      queries.push(sql);
      if(sql.includes("SELECT 1 FROM external_videos.sources s"))
        return {rowCount:authorized?1:0,rows:authorized?[{ok:true}]:[]};
      if(sql.includes("INSERT INTO external_videos.items"))
        return {rowCount:inserted?1:0,rows:inserted?[{item_id:"new-item"}]:[]};
      return {rowCount:0,rows:[]};
    }),
    release:vi.fn(),
  };
  return {pool:{connect:async()=>client} as unknown as Pool,queries,client};
}
describe("J14 canonical video catalog safety",()=>{
  it("denies a revoked source at the database write boundary",async()=>{
    const db=fakePool(false,true);
    await expect(createPostgresYouTubeCatalogSink(db.pool).stagePending(video))
      .rejects.toThrow("youtube_source_not_authorized");
    expect(db.queries.some(q=>q.includes("INSERT INTO external_videos.items"))).toBe(false);
    expect(db.queries).toContain("ROLLBACK");
  });
  it("never attaches an existing manually approved video to an automation source",async()=>{
    const db=fakePool(true,false);
    await createPostgresYouTubeCatalogSink(db.pool).stagePending(video);
    expect(db.queries.some(q=>q.includes("INSERT INTO external_videos.item_sources"))).toBe(false);
    expect(db.queries.some(q=>q.includes("INSERT INTO external_videos.review_audit"))).toBe(false);
    expect(db.queries).toContain("COMMIT");
  });
  it("links only a genuinely new pending video to its verified source",async()=>{
    const db=fakePool(true,true);
    await createPostgresYouTubeCatalogSink(db.pool).stagePending(video);
    expect(db.queries.some(q=>q.includes("INSERT INTO external_videos.item_sources"))).toBe(true);
    expect(db.queries.some(q=>q.includes("INSERT INTO external_videos.review_audit"))).toBe(true);
  });
});
