import { createHash, createHmac } from "node:crypto";

export interface ReplayObjectStore {
  checksumSha256(objectKey:string):Promise<string>;
  deleteObject(objectKey:string):Promise<void>;
  presignGet(objectKey:string,ttlSeconds:number):Promise<{
    readonly url:string;
    readonly expiresAt:string;
  }>;
}

function sha256(value:string|Buffer):string{
  return createHash("sha256").update(value).digest("hex");
}
function hmac(key:string|Buffer,value:string):Buffer{
  return createHmac("sha256",key).update(value,"utf8").digest();
}
function amzTimestamp(date:Date):{date:string;timestamp:string}{
  const timestamp=date.toISOString().replace(/[:-]|\.\d{3}/gu,"");
  return {date:timestamp.slice(0,8),timestamp};
}
function encodePath(key:string):string{
  return key.split("/").map(part=>encodeURIComponent(part)).join("/");
}
function signingKey(secret:string,date:string,region:string):Buffer{
  const kDate=hmac(`AWS4${secret}`,date);
  const kRegion=hmac(kDate,region);
  const kService=hmac(kRegion,"s3");
  return hmac(kService,"aws4_request");
}
function canonicalQuery(entries:readonly [string,string][]):string{
  return [...entries]
    .map(([k,v])=>[encodeURIComponent(k),encodeURIComponent(v)] as const)
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([k,v])=>`${k}=${v}`)
    .join("&");
}

export function createReplayObjectStore(input:Readonly<{
  endpoint:string;
  region:string;
  bucket:string;
  accessKey:string;
  secret:string;
  fetchImpl?:typeof fetch;
  now?:()=>Date;
  maxObjectBytes?:number;
  availabilityAttempts?:number;
  availabilityDelayMs?:number;
  sleep?: (milliseconds:number)=>Promise<void>;
}>):ReplayObjectStore{
  const endpoint=new URL(input.endpoint);
  if(endpoint.protocol!=="https:"||endpoint.pathname!=="/"||
    endpoint.username||endpoint.password||endpoint.search||endpoint.hash){
    throw new TypeError("Replay S3 endpoint must be an HTTPS origin");
  }
  const region=input.region.trim();
  const bucket=input.bucket.trim();
  const accessKey=input.accessKey.trim();
  const secret=input.secret.trim();
  if(!region||!bucket||!accessKey||secret.length<8) throw new TypeError("Replay S3 configuration is incomplete");
  const fetchImpl=input.fetchImpl??fetch;
  const now=input.now??(()=>new Date());
  const maxObjectBytes=input.maxObjectBytes??2*1024*1024*1024;
  const availabilityAttempts=input.availabilityAttempts??8;
  const availabilityDelayMs=input.availabilityDelayMs??500;
  const sleep=input.sleep??((milliseconds:number)=>new Promise<void>((resolve)=>setTimeout(resolve,milliseconds)));
  if(!Number.isSafeInteger(availabilityAttempts)||availabilityAttempts<1||availabilityAttempts>30){
    throw new TypeError("Replay object availability attempts are invalid");
  }
  if(!Number.isSafeInteger(availabilityDelayMs)||availabilityDelayMs<0||availabilityDelayMs>5000){
    throw new TypeError("Replay object availability delay is invalid");
  }

  function objectUrl(objectKey:string):URL{
    const key=objectKey.trim();
    if(!key||key.startsWith("/")||key.includes("..")) throw new TypeError("Replay object key is invalid");
    const url=new URL(endpoint.toString());
    url.pathname=`/${encodeURIComponent(bucket)}/${encodePath(key)}`;
    return url;
  }

  function authHeaders(url:URL,date:Date,method:"GET"|"DELETE"):Record<string,string>{
    const {date:datePart,timestamp}=amzTimestamp(date);
    const payloadHash=sha256("");
    const canonicalHeaders=`host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timestamp}\n`;
    const signedHeaders="host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest=[
      method,
      url.pathname,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const scope=`${datePart}/${region}/s3/aws4_request`;
    const stringToSign=[
      "AWS4-HMAC-SHA256",
      timestamp,
      scope,
      sha256(canonicalRequest),
    ].join("\n");
    const signature=createHmac("sha256",signingKey(secret,datePart,region))
      .update(stringToSign,"utf8")
      .digest("hex");
    return {
      "x-amz-content-sha256":payloadHash,
      "x-amz-date":timestamp,
      authorization:`AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }

  return Object.freeze<ReplayObjectStore>({
    async checksumSha256(objectKey){
      const url=objectUrl(objectKey);
      for(let attempt=1;attempt<=availabilityAttempts;attempt+=1){
        // Redirects must not forward signed S3 requests to another origin or path.
        // A changed endpoint also invalidates the SigV4 canonical request.
        const response=await fetchImpl(url,{
          headers:authHeaders(url,now(),"GET"),
          redirect:"manual",
        });
        if(response.status===404){
          if(attempt<availabilityAttempts){
            await sleep(availabilityDelayMs*attempt);
            continue;
          }
          throw new Error("talks.replay.object_unavailable");
        }
        if(!response.ok||!response.body){
          throw new Error("talks.replay.object_unavailable");
        }
        const length=response.headers.get("content-length");
        if(length!==null&&Number(length)>maxObjectBytes){
          throw new Error("talks.replay.object_too_large");
        }
        const digest=createHash("sha256");
        let bytes=0;
        const reader=response.body.getReader();
        while(true){
          const {done,value}=await reader.read();
          if(done) break;
          bytes+=value.byteLength;
          if(bytes>maxObjectBytes) throw new Error("talks.replay.object_too_large");
          digest.update(value);
        }
        if(bytes>0) return digest.digest("hex");
        if(attempt<availabilityAttempts){
          await sleep(availabilityDelayMs*attempt);
          continue;
        }
        throw new Error("talks.replay.object_empty");
      }
      throw new Error("talks.replay.object_unavailable");
    },

    async deleteObject(objectKey){
      const url=objectUrl(objectKey);
      const response=await fetchImpl(url,{
        method:"DELETE",
        headers:authHeaders(url,now(),"DELETE"),
        redirect:"manual",
      });
      if(!response.ok&&response.status!==404){
        throw new Error("talks.replay.object_delete_failed");
      }
    },

    async presignGet(objectKey,ttlSeconds){
      if(!Number.isSafeInteger(ttlSeconds)||ttlSeconds<30||ttlSeconds>900){
        throw new TypeError("Replay playback TTL must be between 30 and 900 seconds");
      }
      const url=objectUrl(objectKey);
      const issued=now();
      const {date:datePart,timestamp}=amzTimestamp(issued);
      const scope=`${datePart}/${region}/s3/aws4_request`;
      const queryEntries:[string,string][]=[
        ["X-Amz-Algorithm","AWS4-HMAC-SHA256"],
        ["X-Amz-Credential",`${accessKey}/${scope}`],
        ["X-Amz-Date",timestamp],
        ["X-Amz-Expires",String(ttlSeconds)],
        ["X-Amz-SignedHeaders","host"],
      ];
      const query=canonicalQuery(queryEntries);
      const canonicalRequest=[
        "GET",
        url.pathname,
        query,
        `host:${url.host}\n`,
        "host",
        "UNSIGNED-PAYLOAD",
      ].join("\n");
      const stringToSign=[
        "AWS4-HMAC-SHA256",
        timestamp,
        scope,
        sha256(canonicalRequest),
      ].join("\n");
      const signature=createHmac("sha256",signingKey(secret,datePart,region))
        .update(stringToSign,"utf8")
        .digest("hex");
      url.search=`${query}&X-Amz-Signature=${signature}`;
      return Object.freeze({
        url:url.toString(),
        expiresAt:new Date(issued.getTime()+ttlSeconds*1000).toISOString(),
      });
    },
  });
}
