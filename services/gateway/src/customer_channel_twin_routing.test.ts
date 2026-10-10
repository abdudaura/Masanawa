import { describe, expect, it, vi } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import type { CustomerChannelRepository, PlatformSessionRepository } from "@masanawa/security";
import type { PlatformAgentProfileRepository } from "@masanawa/agents";
import type { AgentConversationService } from "./agent_conversation_contract.js";
import type { TwinDirectoryService } from "./twin_directory.js";
import { createCustomerChannelBridge } from "./customer_channel_bridge.js";

function base() {
  const tenantId = createCanonicalId("tenant");
  const userId = createCanonicalId("user");
  const gwani = createCanonicalId("character");
  const twin = createCanonicalId("character");
  const issueSession = vi.fn(async () => undefined);
  const revokeAccess = vi.fn(async () => undefined);
  const sessions = {
    async resolveProfile() { return null; },
    issueSession,
    revokeAccess,
  } as unknown as PlatformSessionRepository;
  let link:any = {
    channel:"whatsapp",
    externalUserId:"+2348012345678",
    chatId:"2348012345678@s.whatsapp.net",
    tenantId,
    userId,
    characterId:gwani,
    characterSessionId:null,
    updatedAt:"2026-10-07T00:00:00.000Z",
  };
  const putLink=vi.fn(async (value:any)=>{link=value;});
  const setCharacterSession=vi.fn(async (value:any)=>{link={...link,...value};});
  const completeMessage=vi.fn(async()=>undefined);
  const channels = {
    async claimMessage(){return {state:"claimed" as const};},
    async readLink(){return link;},
    putLink,
    setCharacterSession,
    completeMessage,
    async failMessage(){},
  } as unknown as CustomerChannelRepository;
  const platformProfiles = {
    async listSupportAgents(){return [{characterId:gwani,supportAgent:true,defaultForNewUsers:true,voiceName:"Bodi"}];},
    async readForCharacter({characterId}:{characterId:string}){
      return characterId===gwani
        ? {characterId:gwani,supportAgent:true,defaultForNewUsers:true,voiceName:"Bodi"}
        : null;
    },
  } as unknown as PlatformAgentProfileRepository;
  return {tenantId,userId,gwani,twin,sessions,channels,platformProfiles,putLink,setCharacterSession,completeMessage,getLink:()=>link};
}

describe("channel Twin routing",()=>{
  it("switches a WhatsApp user to a unique public Twin and persists the Character",async()=>{
    const x=base();
    const twinDirectory: TwinDirectoryService = {
      async resolve(){return null;},
      async search(){return [{
        characterId:x.twin,publicId:"aisha",displayName:"Aisha",headline:"",avatarUrl:null,
        representationLabel:"AI twin" as const,ownerPresence:"not-present" as const,textChatMode:"free" as const,
      }];},
    };
    const bridge=createCustomerChannelBridge({
      tenantId:x.tenantId,sessions:x.sessions,channels:x.channels,platformProfiles:x.platformProfiles,
      conversation:{} as AgentConversationService,twinDirectory,
    });
    const result=await bridge.handle({
      channel:"whatsapp",messageId:"m1",externalUserId:"+2348012345678",
      chatId:"2348012345678@s.whatsapp.net",text:"talk to Aisha's twin",
    });
    expect(result.reply).toContain("Aisha's AI Twin");
    expect(result.reply).toContain("Text chat here is free");
    expect(x.putLink).toHaveBeenCalledWith(expect.objectContaining({characterId:x.twin,characterSessionId:null}));
  });

  it("resolves a stable public Twin id before searching display names",async()=>{
    const x=base();
    const resolve=vi.fn(async()=>({
      characterId:x.twin,publicId:"aisha",displayName:"Aisha",headline:"",avatarUrl:null,
      representationLabel:"AI twin" as const,ownerPresence:"not-present" as const,textChatMode:"free" as const,
    }));
    const search=vi.fn(async()=>[]);
    const twinDirectory: TwinDirectoryService={resolve,search};
    const bridge=createCustomerChannelBridge({
      tenantId:x.tenantId,sessions:x.sessions,channels:x.channels,platformProfiles:x.platformProfiles,
      conversation:{} as AgentConversationService,twinDirectory,
    });
    const result=await bridge.handle({
      channel:"whatsapp",messageId:"stable-id",externalUserId:"+2348012345678",
      chatId:"2348012345678@s.whatsapp.net",text:"talk to Aisha's twin",
    });
    expect(result.reply).toContain("Aisha's AI Twin");
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({publicId:"Aisha"}));
    expect(search).not.toHaveBeenCalled();
    expect(x.getLink().characterId).toBe(x.twin);
  });

  it("passes Telegram public-Twin surface context into the canonical conversation",async()=>{
    const x=base();
    await x.putLink({...x.getLink(),channel:"telegram",externalUserId:"55",chatId:"55",characterId:x.twin});
    const turn=vi.fn(async()=>({reply:"Twin reply",agentRunId:createCanonicalId("agent-run"),parts:[]}));
    const conversation={
      async open(){return {characterSessionId:createCanonicalId("character-session")};},
      turn,
    } as unknown as AgentConversationService;
    const bridge=createCustomerChannelBridge({
      tenantId:x.tenantId,sessions:x.sessions,channels:x.channels,platformProfiles:x.platformProfiles,conversation,
    });
    const result=await bridge.handle({
      channel:"telegram",messageId:"tg1",externalUserId:"55",chatId:"55",text:"hello",
    });
    expect(result.reply).toBe("Twin reply");
    expect(turn).toHaveBeenCalledWith(expect.objectContaining({
      surface:"telegram",representation:"public-twin",characterId:x.twin,
    }));
  });

  it("returns from a Twin to Gwani without changing the user account",async()=>{
    const x=base();
    await x.putLink({...x.getLink(),characterId:x.twin});
    const bridge=createCustomerChannelBridge({
      tenantId:x.tenantId,sessions:x.sessions,channels:x.channels,platformProfiles:x.platformProfiles,
      conversation:{} as AgentConversationService,
    });
    const result=await bridge.handle({
      channel:"whatsapp",messageId:"m2",externalUserId:"+2348012345678",
      chatId:"2348012345678@s.whatsapp.net",text:"back to Gwani",
    });
    expect(result.reply).toContain("back with Gwani");
    expect(x.putLink).toHaveBeenCalledWith(expect.objectContaining({
      userId:x.userId,characterId:x.gwani,characterSessionId:null,
    }));
  });

  it("does not guess when multiple public Twins match",async()=>{
    const x=base();
    const other=createCanonicalId("character");
    const twinDirectory: TwinDirectoryService={
      async resolve(){return null;},
      async search(){return [
        {characterId:x.twin,publicId:"aisha-one",displayName:"Aisha Bello",headline:"",avatarUrl:null,representationLabel:"AI twin" as const,ownerPresence:"not-present" as const,textChatMode:"free" as const},
        {characterId:other,publicId:"aisha-two",displayName:"Aisha Musa",headline:"",avatarUrl:null,representationLabel:"AI twin" as const,ownerPresence:"not-present" as const,textChatMode:"free" as const},
      ];},
    };
    const bridge=createCustomerChannelBridge({
      tenantId:x.tenantId,sessions:x.sessions,channels:x.channels,platformProfiles:x.platformProfiles,
      conversation:{} as AgentConversationService,twinDirectory,
    });
    const result=await bridge.handle({
      channel:"whatsapp",messageId:"m3",externalUserId:"+2348012345678",
      chatId:"2348012345678@s.whatsapp.net",text:"talk to Aisha twin",
    });
    expect(result.reply).toContain("several public Twins");
    expect(x.getLink().characterId).toBe(x.gwani);
  });
});
