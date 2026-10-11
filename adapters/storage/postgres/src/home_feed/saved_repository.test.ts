import {describe,expect,it,vi} from "vitest";
import {PgSavedLibraryRepository} from "./saved_repository.js";
describe("C25 PG query fences",()=>{
  it("reads only tenant+fan saves with approved Masana/video and stable cursor",async()=>{
    const query=vi.fn(async()=>({rows:[]}));
    const repo=new PgSavedLibraryRepository({query} as never);
    await repo.list("tenant-one","fan-one",null,21);
    const [sql,values]=query.mock.calls[0] as unknown as [string,unknown[]];
    expect(sql).toContain("s.tenant_id=$1 AND s.fan_id=$2");
    expect(sql).toContain("v.tenant_id=$1 AND v.fan_id=$2");
    expect(sql).toContain("i.review_state='approved'");
    expect(sql).toContain("p.state='published'");
    expect(values).toEqual(["tenant-one","fan-one",null,null,null,21]);
  });
  it("cannot insert a hidden video and removes only current fan's save",async()=>{
    const query=vi.fn(async()=>({rows:[],rowCount:0}));
    const repo=new PgSavedLibraryRepository({query} as never);
    expect(await repo.setVideoSaved("t","f","dddddddd-dddd-4ddd-8ddd-dddddddddddd",true)).toBe(false);
    expect(query.mock.calls[0]![0]).toContain("review_state='approved'");
    await repo.setVideoSaved("t","f","dddddddd-dddd-4ddd-8ddd-dddddddddddd",false);
    expect(query.mock.calls[2]![1]).toEqual(["t","f","dddddddd-dddd-4ddd-8ddd-dddddddddddd"]);
  });
});
