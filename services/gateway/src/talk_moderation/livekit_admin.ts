import { createHmac } from "node:crypto";

export interface TalkMediaAdmin {
  setCanPublish(input: Readonly<{
    room: string;
    identity: string;
    canPublish: boolean;
  }>): Promise<void>;
  removeParticipant(input: Readonly<{
    room: string;
    identity: string;
  }>): Promise<void>;
}

function base64url(value:string):string{
  return Buffer.from(value,"utf8").toString("base64url");
}
function token(input:{apiKey:string;apiSecret:string;room:string;now:Date}):string{
  const issued=Math.floor(input.now.getTime()/1000);
  const header=base64url(JSON.stringify({alg:"HS256",typ:"JWT"}));
  const payload=base64url(JSON.stringify({
    iss:input.apiKey,iat:issued,nbf:issued-5,exp:issued+60,
    video:{roomAdmin:true,room:input.room},
  }));
  const signing=`${header}.${payload}`;
  const signature=createHmac("sha256",input.apiSecret).update(signing,"utf8").digest("base64url");
  return `${signing}.${signature}`;
}

export function createLiveKitTalkMediaAdmin(input:Readonly<{
  serverUrl:string;
  apiKey:string;
  apiSecret:string;
  fetchImpl?:typeof fetch;
  now?:()=>Date;
}>):TalkMediaAdmin{
  const url=input.serverUrl.trim().replace(/^wss:/u,"https:").replace(/^ws:/u,"http:").replace(/\/$/u,"");
  const apiKey=input.apiKey.trim();
  const apiSecret=input.apiSecret.trim();
  if(!/^https?:\/\//u.test(url)) throw new TypeError("LiveKit server URL is invalid");
  if(!apiKey || apiSecret.length<16) throw new TypeError("LiveKit admin credentials are invalid");
  const fetchImpl=input.fetchImpl ?? fetch;
  const now=input.now ?? (()=>new Date());

  async function call(method:string,room:string,body:Record<string,unknown>):Promise<void>{
    const response=await fetchImpl(`${url}/twirp/livekit.RoomService/${method}`,{
      method:"POST",
      headers:{
        authorization:`Bearer ${token({apiKey,apiSecret,room,now:now()})}`,
        "content-type":"application/json",
      },
      body:JSON.stringify(body),
    });
    if(!response.ok){
      throw new Error(`talks.media_admin_${method.toLowerCase()}_failed`);
    }
  }

  return Object.freeze<TalkMediaAdmin>({
    async setCanPublish(request){
      await call("UpdateParticipant",request.room,{
        room:request.room,
        identity:request.identity,
        permission:{
          can_publish:request.canPublish,
          can_subscribe:true,
          can_publish_data:false,
          ...(request.canPublish?{can_publish_sources:["MICROPHONE"]}:{}),
        },
      });
    },
    async removeParticipant(request){
      await call("RemoveParticipant",request.room,{
        room:request.room,
        identity:request.identity,
        // LiveKit Cloud revocation timestamps are Unix milliseconds, not JWT seconds.
        revoke_token_ts:now().getTime(),
      });
    },
  });
}

