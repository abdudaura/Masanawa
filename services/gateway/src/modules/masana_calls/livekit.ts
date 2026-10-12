import { createHmac } from "node:crypto";
import type { CallProvider } from "./service.js";
/** No Talk seat grants; signed short-lived one-room microphone credential. */
export function createMasanaLiveKitProvider(input: {
  url: string; apiKey: string; apiSecret: string;
  dispatch: CallProvider["dispatch"]; stop: CallProvider["stop"];
  now?: () => Date;
}): CallProvider {
  if (!/^wss:\/\//.test(input.url) || !input.apiKey.trim() || input.apiSecret.length<16)
    throw new TypeError("unqualified_livekit_config");
  const clock=input.now??(()=>new Date());
  const encode=(v: unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
  return {
    dispatch:input.dispatch,stop:input.stop,
    async token({callId,roomName,fanUserId}) {
      const iat=Math.floor(clock().getTime()/1000),exp=iat+90;
      const header=encode({alg:"HS256",typ:"JWT"});
      const payload=encode({
        iss:input.apiKey,sub:fanUserId+":"+callId,iat,nbf:iat-5,exp,
        video:{roomJoin:true,room:roomName,canPublish:true,canSubscribe:true,
          canPublishData:false,canPublishSources:["microphone"]},
        metadata:JSON.stringify({call_session_id:callId,role:"fan"}),
      });
      const signed=header+"."+payload;
      const signature=createHmac("sha256",input.apiSecret).update(signed).digest("base64url");
      return {url:input.url,token:signed+"."+signature,expiresAt:new Date(exp*1000).toISOString()};
    },
  };
}
