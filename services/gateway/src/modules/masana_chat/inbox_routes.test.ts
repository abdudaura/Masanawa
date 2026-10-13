import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerMasanaInboxRoutes } from "./inbox_routes.js";
const character = "character_0199f0d0-0000-7000-8000-000000000003";
function fixture() {
  const app=Fastify();
  const resolveFan=vi.fn(async () => ({tenantId:"tenant-a",fanUserId:"fan-a"}));
  const list=vi.fn(async () => [{
    characterId:character,displayName:"Gwana",profession:"Teacher",
    lastMessage:"Salam",lastActivityAt:"2026-10-11",pinned:false,
    unreadCount:1,revision:0,
  }]);
  const setPinned=vi.fn(async () => 1 as number|null);
  const markRead=vi.fn(async () => 2 as number|null);
  registerMasanaInboxRoutes(app,{resolveFan,inbox:{list,setPinned,markRead}});
  return {app,resolveFan,list,setPinned,markRead};
}
describe("C10 authenticated Chats list HTTP",()=>{
  it("requires bearer authorization before any private read or write",async()=>{
    const f=fixture();
    try {
      for(const [method,url] of [
        ["GET","/v1/chats"],["PATCH","/v1/chats/"+character],
        ["POST","/v1/chats/"+character+"/read"],
      ] as const){
        const result=await f.app.inject({method,url});
        expect(result.statusCode).toBe(401);
      }
      expect(f.resolveFan).not.toHaveBeenCalled();
      expect(f.list).not.toHaveBeenCalled();
      expect(f.setPinned).not.toHaveBeenCalled();
    }finally{await f.app.close();}
  });
  it("ignores forged tenant and fan in list and pin payload",async()=>{
    const f=fixture(),headers={authorization:"Bearer fan"};
    try{
      const result=await f.app.inject({method:"GET",
        url:"/v1/chats?q=teacher&tenantId=other",headers});
      expect(result.statusCode).toBe(200);
      expect(result.json().chats[0].displayName).toBe("Gwana");
      expect(f.list).toHaveBeenCalledWith({
        tenantId:"tenant-a",fanUserId:"fan-a"},"teacher");
      const pin=await f.app.inject({method:"PATCH",url:"/v1/chats/"+character,
        headers,payload:{tenantId:"other",fanUserId:"other",
          pinned:true,expectedRevision:0}});
      expect(pin.statusCode).toBe(200);
      expect(f.setPinned).toHaveBeenCalledWith({
        tenantId:"tenant-a",fanUserId:"fan-a"},character,true,0);
    }finally{await f.app.close();}
  });
  it("rejects wildcard-length/invalid ids and revision conflicts",async()=>{
    const f=fixture(),headers={authorization:"Bearer fan"};
    try{
      expect((await f.app.inject({method:"GET",
        url:"/v1/chats?q="+"x".repeat(81),headers})).statusCode).toBe(422);
      expect((await f.app.inject({method:"PATCH",
        url:"/v1/chats/"+character,headers,
        payload:{pinned:true,expectedRevision:-1}})).statusCode).toBe(422);
      f.setPinned.mockResolvedValueOnce(null);
      expect((await f.app.inject({method:"PATCH",
        url:"/v1/chats/"+character,headers,
        payload:{pinned:true,expectedRevision:0}})).statusCode).toBe(409);
      f.markRead.mockResolvedValueOnce(null);
      expect((await f.app.inject({method:"POST",
        url:"/v1/chats/"+character+"/read",headers})).statusCode).toBe(404);
    }finally{await f.app.close();}
  });
});
