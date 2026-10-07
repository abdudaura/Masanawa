import { createHmac } from "node:crypto";

export interface LiveKitReplayEgress {
  start(input: Readonly<{
    roomName: string;
    objectKey: string;
  }>): Promise<{ readonly egressId: string }>;
  stop(egressId: string): Promise<void>;
}

function base64url(value:string):string{
  return Buffer.from(value,"utf8").toString("base64url");
}

function accessToken(input:{
  apiKey:string;
  apiSecret:string;
  now:Date;
}):string{
  const issued=Math.floor(input.now.getTime()/1000);
  const header=base64url(JSON.stringify({alg:"HS256",typ:"JWT"}));
  const payload=base64url(JSON.stringify({
    iss:input.apiKey,
    iat:issued,
    nbf:issued-5,
    exp:issued+60,
    video:{roomRecord:true},
  }));
  const signing=`${header}.${payload}`;
  const signature=createHmac("sha256",input.apiSecret)
    .update(signing,"utf8")
    .digest("base64url");
  return `${signing}.${signature}`;
}

export function createLiveKitReplayEgress(input:Readonly<{
  serverUrl:string;
  apiKey:string;
  apiSecret:string;
  s3:Readonly<{
    endpoint:string;
    region:string;
    bucket:string;
    accessKey:string;
    secret:string;
  }>;
  fetchImpl?:typeof fetch;
  now?:()=>Date;
}>):LiveKitReplayEgress{
  const serverUrl=input.serverUrl.trim()
    .replace(/^wss:/u,"https:")
    .replace(/^ws:/u,"http:")
    .replace(/\/$/u,"");
  const apiKey=input.apiKey.trim();
  const apiSecret=input.apiSecret.trim();
  const endpoint=input.s3.endpoint.trim().replace(/\/$/u,"");
  const region=input.s3.region.trim();
  const bucket=input.s3.bucket.trim();
  const accessKey=input.s3.accessKey.trim();
  const secret=input.s3.secret.trim();
  if(!/^https?:\/\//u.test(serverUrl)) throw new TypeError("LiveKit Egress URL is invalid");
  if(!apiKey || apiSecret.length<16) throw new TypeError("LiveKit Egress credentials are invalid");
  if(!/^https:\/\//u.test(endpoint)) throw new TypeError("Replay S3 endpoint must use https://");
  if(!region || !bucket || !accessKey || secret.length<8) throw new TypeError("Replay S3 configuration is incomplete");
  const fetchImpl=input.fetchImpl??fetch;
  const now=input.now??(()=>new Date());

  async function call(method:string,body:Record<string,unknown>):Promise<Record<string,unknown>>{
    const response=await fetchImpl(`${serverUrl}/twirp/livekit.Egress/${method}`,{
      method:"POST",
      headers:{
        authorization:`Bearer ${accessToken({apiKey,apiSecret,now:now()})}`,
        "content-type":"application/json",
      },
      body:JSON.stringify(body),
    });
    if(!response.ok){
      throw new Error(`talks.replay.egress_${method.toLowerCase()}_failed`);
    }
    return await response.json() as Record<string,unknown>;
  }

  return Object.freeze({
    async start(request){
      const payload=await call("StartEgress",{
        room_name:request.roomName,
        template:{audio_only:true},
        outputs:[{
          file:{
            file_type:"OGG",
            filepath:request.objectKey,
          },
        }],
        storage:{
          s3:{
            access_key:accessKey,
            secret,
            region,
            bucket,
            endpoint,
            force_path_style:true,
          },
        },
      });
      const egressId=payload.egress_id;
      if(typeof egressId!=="string"||!egressId.trim()){
        throw new Error("talks.replay.egress_missing_id");
      }
      return Object.freeze({egressId});
    },
    async stop(egressId){
      if(!egressId.trim()) throw new TypeError("Replay egress id is required");
      await call("StopEgress",{egress_id:egressId});
    },
  });
}
