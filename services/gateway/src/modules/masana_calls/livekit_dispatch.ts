import { createHmac } from "node:crypto";
import type { CallProvider } from "./service.js";
import { createMasanaLiveKitProvider } from "./livekit.js";

/**
 * Scoped server-to-LiveKit Twirp transport. Credentials never reach Flutter.
 * AgentDispatchService/CreateDispatch auto-creates a room, avoiding another
 * room registry. Calls recheck their PG session in the Python presence worker.
 */
export function createMasanaLiveKitDispatch(input: {
  url: string; apiKey: string; apiSecret: string; agentName?: string;
  enabled: () => Promise<boolean>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}): CallProvider {
  const base=input.url.replace(/^wss:\/\//,"https://").replace(/\/+$/,"");
  if (!/^https:\/\/[^/]+$/.test(base)) throw new TypeError("invalid_livekit_host");
  const transport=input.fetchImpl??fetch, clock=input.now??(()=>new Date());
  const name=input.agentName??"masanawa-calls";
  if (!/^[a-z0-9-]{1,63}$/.test(name)) throw new TypeError("invalid_agent_name");
  function adminToken(roomName:string):string {
    const timestamp=Math.floor(clock().getTime()/1000);
    const encoded=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString("base64url");
    const header=encoded({alg:"HS256",typ:"JWT"});
    const payload=encoded({
      iss:input.apiKey,sub:"masanawa-call-dispatch",
      iat:timestamp,nbf:timestamp-5,exp:timestamp+45,
      video:{roomAdmin:true,roomCreate:true,room:roomName},
    });
    const message=header+"."+payload;
    return message+"."+createHmac("sha256",input.apiSecret).update(message).digest("base64url");
  }
  async function send(roomName:string, service:string,method:string,payload:unknown):Promise<void> {
    // The kill switch blocks new dispatches, never shutdown of an existing room.
    if (method==="CreateDispatch" && !await input.enabled()) throw new Error("calls_provider_off");
    const response=await transport(base+"/twirp/livekit."+service+"/"+method,{
      method:"POST",
      headers:{"authorization":"Bearer "+adminToken(roomName),"content-type":"application/json"},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("livekit_request_rejected");
  }
  const baseProvider=createMasanaLiveKitProvider({
    url:input.url,apiKey:input.apiKey,apiSecret:input.apiSecret,now:clock,
    dispatch:async ({tenantId,callId,characterId,roomName})=>{
      await send(roomName,"AgentDispatchService","CreateDispatch",{
        agent_name:name,room:roomName,
        metadata:JSON.stringify({schemaVersion:1,tenantId,callId,characterId,roomName}),
      });
    },
    stop:async({roomName})=>{
      await send(roomName,"RoomService","DeleteRoom",{room:roomName});
    },
  });
  return baseProvider;
}
