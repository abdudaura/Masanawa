import { createHmac } from "node:crypto";
import type { HumanCall,HumanCallMediaIssuer,CallCredentials } from "./service.js";

export interface HumanCallRoomRevoker {
  /** Backend-only LiveKit RoomServiceClient.deleteRoom or equivalent.
   * Must remove every participant, not just delete an app session flag. */
  closeRoom(roomName: string): Promise<void>;
}
function base64(value:string):string {
  return Buffer.from(value,"utf8").toString("base64url");
}
export function createHumanCallMediaIssuer(input: {
  serverUrl:string;apiKey:string;apiSecret:string;
  revoker:HumanCallRoomRevoker;
  now?:()=>Date;
  ttlSeconds?:number;
}): HumanCallMediaIssuer {
  const url=new URL(input.serverUrl);
  if(url.protocol!=="wss:" || url.username || url.password ||
     url.search || url.hash || url.pathname!=="/") {
    throw new TypeError("LiveKit private call URL must be a clean wss:// origin");
  }
  if(!input.apiKey.trim() || input.apiSecret.length<16) {
    throw new TypeError("LiveKit server credentials unavailable");
  }
  const ttl=input.ttlSeconds??45;
  if(!Number.isSafeInteger(ttl)||ttl<30||ttl>90) {
    throw new TypeError("Private call token TTL out of bounds");
  }
  const now=input.now??(()=>new Date());
  function name(callId:string) { return "human-call_"+callId; }
  return Object.freeze({
    async mint({call,userId}:{call:HumanCall;userId:string}):Promise<CallCredentials> {
      if(call.state!=="active" || ![call.callerUserId,call.calleeUserId].includes(userId)) {
        throw new Error("Private call is not active for participant");
      }
      const seconds=Math.floor(now().getTime()/1000);
      const room=name(call.callId);
      // Do not put phone numbers, person names, private DM content, tenant IDs,
      // raw auth tokens, or financial identifiers in LiveKit room metadata.
      const identity=base64(userId).slice(0,100);
      const grant={
        roomJoin:true,room,
        canPublish:true,canSubscribe:true,canPublishData:false,
        canPublishSources:call.kind==="video"?["microphone","camera"]:["microphone"],
        canUpdateOwnMetadata:false,roomAdmin:false,roomRecord:false,
      };
      const payload={iss:input.apiKey,sub:identity,iat:seconds,nbf:seconds-5,
        exp:seconds+ttl,video:grant};
      const header=base64(JSON.stringify({alg:"HS256",typ:"JWT"}));
      const encoded=base64(JSON.stringify(payload));
      const body=`${header}.${encoded}`;
      const signature=createHmac("sha256",input.apiSecret).update(body).digest("base64url");
      return Object.freeze({
        server_url:url.toString(),participant_token:`${body}.${signature}`,
        room_name:room,participant_identity:identity,
        expires_at:new Date((seconds+ttl)*1000).toISOString(),
      });
    },
    async terminate(callId:string) {
      await input.revoker.closeRoom(name(callId));
    },
  });
}
