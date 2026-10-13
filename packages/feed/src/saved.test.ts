import {describe,expect,it,vi} from "vitest";
import {SavedError,SavedLibraryService,type SavedRepository} from "./saved.js";
const fan={kind:"fan" as const,id:"fan-one",tenantId:"tenant-one"};
const id="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
function store():SavedRepository{return {list:vi.fn(async()=>[]),setVideoSaved:vi.fn(async()=>true)};}
describe("C25 saved library authority",()=>{
  it("rejects staff, Masana and malformed cursors before querying storage",async()=>{
    const repo=store(),svc=new SavedLibraryService(repo);
    await expect(svc.list({...fan,kind:"staff"})).rejects.toMatchObject({status:403});
    await expect(svc.list(fan,"%%%")).rejects.toMatchObject({status:422});
    await expect(svc.saveVideo(fan,"../../../other",true)).rejects.toMatchObject({status:422});
    await expect(svc.saveVideo({...fan,kind:"masana"},id,true)).rejects.toMatchObject({status:403});
    expect(repo.list).not.toHaveBeenCalled();
  });
  it("fences one page, stable cursor, fan and tenant",async()=>{
    const repo=store(),items=Array.from({length:21},(_,i)=>({
      kind:"post" as const,id:"dddddddd-dddd-4ddd-8ddd-"+i.toString().padStart(12,"0"),
      savedAt:"2026-10-10T10:00:00.000Z",post:{id:i}
    }));
    vi.mocked(repo.list).mockResolvedValue(items);
    const svc=new SavedLibraryService(repo),page=await svc.list(fan);
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toBeTruthy();
    await svc.list(fan,page.nextCursor!);
    expect(repo.list).toHaveBeenLastCalledWith("tenant-one","fan-one",
      {at:items[19]!.savedAt,kind:"post",id:items[19]!.id},21);
  });
  it("does not report hidden or unavailable videos as newly saved",async()=>{
    const repo=store();vi.mocked(repo.setVideoSaved).mockResolvedValue(false);
    const svc=new SavedLibraryService(repo);
    await expect(svc.saveVideo(fan,id,true)).rejects.toMatchObject({status:404});
    await expect(svc.saveVideo(fan,id,false)).resolves.toEqual({saved:false});
  });
});
