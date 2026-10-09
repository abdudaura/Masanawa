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

const MAX_EGRESS_RESPONSE_BYTES=64*1024;
// External Egress RPCs can have uncertain side effects after a client timeout.
// Abort the HTTPS request, but do not automatically retry Start/StopEgress.
const DEFAULT_EGRESS_REQUEST_TIMEOUT_MS=30_000;

function secureOrigin(raw:string,label:string,websocket=false):string{
  const candidate=raw.trim();
  const normalized=websocket&&/^wss:\/\//iu.test(candidate)
    ? `https://${candidate.slice(6)}`
    :candidate;
  let url:URL;
  try{url=new URL(normalized);}catch{throw new TypeError(`${label} is invalid`);}
  // This endpoint receives a bearer JWT and an S3 secret in StartEgress.
  // Accept only a clean TLS origin, never an HTTP downgrade or URL credentials.
  if(url.protocol!=="https:"||!url.hostname||url.username||url.password||
      url.pathname!=="/"||url.search||url.hash){
    throw new TypeError(`${label} must be a clean HTTPS origin`);
  }
  return url.origin;
}

async function boundedEgressResponse(response:Response):Promise<Record<string,unknown>>{
  if(Number(response.headers.get("content-length"))>MAX_EGRESS_RESPONSE_BYTES){
    throw new Error("talks.replay.egress_response_too_large");
  }
  if(!response.body) throw new Error("talks.replay.egress_invalid_response");
  const reader=response.body.getReader();
  const chunks:Uint8Array[]=[];
  let length=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done) break;
      length+=value.byteLength;
      if(length>MAX_EGRESS_RESPONSE_BYTES){
        await reader.cancel().catch(()=>{});
        throw new Error("talks.replay.egress_response_too_large");
      }
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let payload:unknown;
  try{payload=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}
  catch{throw new Error("talks.replay.egress_invalid_response");}
  if(!payload||typeof payload!=="object"||Array.isArray(payload)){
    throw new Error("talks.replay.egress_invalid_response");
  }
  return payload as Record<string,unknown>;
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
  requestTimeoutMs?:number;
}>):LiveKitReplayEgress{
  const serverUrl=secureOrigin(input.serverUrl,"LiveKit Egress URL",true);
  const apiKey=input.apiKey.trim();
  const apiSecret=input.apiSecret.trim();
  const endpoint=secureOrigin(input.s3.endpoint,"Replay S3 endpoint");
  const region=input.s3.region.trim();
  const bucket=input.s3.bucket.trim();
  const accessKey=input.s3.accessKey.trim();
  const secret=input.s3.secret.trim();
  if(!apiKey || apiSecret.length<16) throw new TypeError("LiveKit Egress credentials are invalid");
  if(!region || !bucket || !accessKey || secret.length<8) throw new TypeError("Replay S3 configuration is incomplete");
  const fetchImpl=input.fetchImpl??fetch;
  const now=input.now??(()=>new Date());
  const timeoutMs=input.requestTimeoutMs??DEFAULT_EGRESS_REQUEST_TIMEOUT_MS;
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<10||timeoutMs>120_000){
    throw new TypeError("LiveKit Egress request timeout must be 10–120000 milliseconds");
  }

  async function call(method:"StartEgress"|"StopEgress",body:Record<string,unknown>):Promise<Record<string,unknown>>{
    // The timeout signal covers connection establishment and response-body
    // streaming. A timed-out StartEgress may still have started remotely;
    // callers must reconcile provider truth rather than blindly retrying.
    const signal=AbortSignal.timeout(timeoutMs);
    try{
      const response=await fetchImpl(`${serverUrl}/twirp/livekit.Egress/${method}`,{
        method:"POST",
        redirect:"manual",
        signal,
        headers:{
          authorization:`Bearer ${accessToken({apiKey,apiSecret,now:now()})}`,
          "content-type":"application/json",
        },
        body:JSON.stringify(body),
      });
      if(!response.ok){
        throw new Error(`talks.replay.egress_${method.toLowerCase()}_failed`);
      }
      return await boundedEgressResponse(response);
    }catch(error){
      if(signal.aborted){
        throw new Error(`talks.replay.egress_${method.toLowerCase()}_timeout_uncertain`,{cause:error});
      }
      throw error;
    }
  }

  return Object.freeze<LiveKitReplayEgress>({
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
