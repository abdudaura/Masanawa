import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerMasanaMessageActionRoutes } from "./message_actions.js";
const character="character_0199f0d0-0000-7000-8000-000000000003";
const turn="request_0199f0d0-0000-7000-8000-000000000002";
function setup({enabled=true,approved=true,owned=true}={}) {
  const app=Fastify();
  const resolveFan=vi.fn(async()=>({tenantId:"tenant-a",fanUserId:"fan-a"}));
  const eligibility=vi.fn(async()=>approved);
  const hide=vi.fn(async()=>owned);
  registerMasanaMessageActionRoutes(app,{
    enabled:()=>enabled, resolveFan,
    eligibility:{isApprovedPlatformMasana:eligibility},
    store:{hideOwnedSentTurn:hide},
  });
  return {app,resolveFan,eligibility,hide};
}
describe("C13 Masana message-actions admission",()=>{
  it("is default-off and never reaches storage",async()=>{
    const h=setup({enabled:false});
    try {const r=await h.app.inject({method:"POST",url:`/v1/masana/${character}/chat/turns/${turn}/hide`});
      expect(r.statusCode).toBe(410);expect(h.hide).not.toHaveBeenCalled();
    } finally{await h.app.close();}
  });
  it("allows idempotent verified own-turn hide without trusting any caller body",async()=>{
    const h=setup();
    try {const r=await h.app.inject({method:"POST",url:`/v1/masana/${character}/chat/turns/${turn}/hide`,
      payload:{tenantId:"other",fanUserId:"other"}});
      expect(r.statusCode).toBe(200);expect(h.hide).toHaveBeenCalledWith(
        {tenantId:"tenant-a",fanUserId:"fan-a"},character,turn);
    }finally{await h.app.close();}
  });
  it("never reveals foreign turn existence or accepts an unapproved character",async()=>{
    const h=setup({approved:false});
    try {const r=await h.app.inject({method:"POST",url:`/v1/masana/${character}/chat/turns/${turn}/hide`});
      expect(r.statusCode).toBe(404);expect(h.hide).not.toHaveBeenCalled();
    }finally{await h.app.close();}
    const f=setup({owned:false});
    try {const r=await f.app.inject({method:"POST",url:`/v1/masana/${character}/chat/turns/${turn}/hide`});
      expect(r.statusCode).toBe(404);
    }finally{await f.app.close();}
  });
  it("rejects malformed source IDs",async()=>{
    const h=setup();
    try {const r=await h.app.inject({method:"POST",url:`/v1/masana/${character}/chat/turns/request_bad/hide`});
      expect(r.statusCode).toBe(422);expect(h.hide).not.toHaveBeenCalled();
    }finally{await h.app.close();}
  });
});
