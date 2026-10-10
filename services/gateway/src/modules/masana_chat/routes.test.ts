import Fastify from "fastify";
import { describe, it, expect, vi } from "vitest";
import type { AgentConversationService } from "../../agent_conversation_contract.js";
import { registerMasanaChatRoutes } from "./routes.js";

const characterId="character_0199f0d0-0000-7000-8000-000000000003";
const sessionId="character-session_0199f0d0-0000-7000-8000-000000000001";
const requestId="request_0199f0d0-0000-7000-8000-000000000002";

function harness(approved: boolean) {
  const app=Fastify();
  const resolveFan=vi.fn(async () => ({tenantId:"tenant-a",fanUserId:"fan-a"}));
  const eligible=vi.fn(async () => approved);
  const open=vi.fn(async () => ({characterSessionId:sessionId}));
  const turn=vi.fn(async () => ({reply:"Teacher reply",agentRunId:"run-a",parts:[]}));
  const close=vi.fn(async () => undefined);
  registerMasanaChatRoutes(app,{
    resolveFan,
    eligibility:{isApprovedPlatformMasana:eligible},
    conversations:{open,turn,close} as unknown as AgentConversationService,
  });
  return {app,resolveFan,eligible,open,turn,close};
}
describe("J03 Masana chat fan-only HTTP admission",()=>{
  it("denies human/draft/unapproved character before opening a session",async()=>{
    const h=harness(false);
    try{
      const res=await h.app.inject({method:"POST",
        url:"/v1/masana/"+characterId+"/chat/sessions",
        headers:{authorization:"Bearer fan-token"}});
      expect(res.statusCode).toBe(403);
      expect(h.open).not.toHaveBeenCalled();
      expect(h.eligible).toHaveBeenCalledWith({
        tenantId:"tenant-a",characterId,
      });
    }finally{await h.app.close();}
  });
  it("rechecks eligibility per turn, preserves request ID and never trusts a payload tenant",async()=>{
    const h=harness(true);
    const root="/v1/masana/"+characterId+"/chat/sessions";
    const headers={authorization:"Bearer fan-token"};
    try{
      const opened=await h.app.inject({method:"POST",url:root,headers});
      expect(opened.statusCode).toBe(201);
      const turn=await h.app.inject({method:"POST",
        url:root+"/"+sessionId+"/turns",headers,
        payload:{tenantId:"tenant-other",userId:"fan-other",
          text:"Hi",requestId},
      });
      expect(turn.statusCode).toBe(200);
      expect(turn.json().reply).toBe("Teacher reply");
      expect(h.turn).toHaveBeenCalledWith(expect.objectContaining({
        authorizationHeader:"Bearer fan-token",characterId,
        characterSessionId:sessionId,requestId,
        representation:"platform-agent",surface:"mobile",
      }));
      const invalid=await h.app.inject({method:"POST",
        url:root+"/"+sessionId+"/turns",headers,
        payload:{text:"Hi",requestId:"bad-id"},
      });
      expect(invalid.statusCode).toBe(422);
      const closed=await h.app.inject({method:"POST",
        url:root+"/"+sessionId+"/close",headers});
      expect(closed.statusCode).toBe(200);
      expect(h.eligible).toHaveBeenCalledTimes(3);
      expect(h.close).toHaveBeenCalledOnce();
    }finally{await h.app.close();}
  });
  it("returns denial for malformed character IDs and cannot open human sessions",async()=>{
    const h=harness(true);
    try{
      const res=await h.app.inject({method:"POST",
        url:"/v1/masana/human-a/chat/sessions",
        headers:{authorization:"Bearer fan-token"}});
      expect(res.statusCode).toBe(403);
      expect(h.open).not.toHaveBeenCalled();
      expect(h.eligible).not.toHaveBeenCalled();
    }finally{await h.app.close();}
  });
});
