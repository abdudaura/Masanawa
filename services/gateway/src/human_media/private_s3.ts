import { createHash, createHmac } from "node:crypto";
import type { PrivateVoiceObjectStore } from "./model.js";

const keyPattern=/^dm-voice\/[a-f0-9]{32}\/[a-f0-9-]{36}\/[a-f0-9]{32}\/[a-f0-9-]{36}\.ogg$/u;
const sha256=(b:Buffer|string)=>createHash("sha256").update(b).digest("hex");
const mac=(k:Buffer|string,s:string)=>createHmac("sha256",k).update(s,"utf8").digest();
function signingKey(secret:string,date:string,region:string):Buffer {
 return mac(mac(mac(mac("AWS4"+secret,date),region),"s3"),"aws4_request");
}
/** Private bucket only. Reads are proxied through per-request authenticated Gateway access. */
export function createPrivateVoiceS3(input:Readonly<{
 endpoint:string;region:string;bucket:string;accessKey:string;secretKey:string;
 fetchImpl?:typeof fetch;now?:()=>Date;
}>):PrivateVoiceObjectStore {
 const origin=new URL(input.endpoint);
 if(origin.protocol!=="https:"||origin.username||origin.password||
    origin.pathname!=="/"||origin.search||origin.hash)
   throw new TypeError("Private media S3 requires plain HTTPS origin");
 if(!/^[a-z0-9][a-z0-9.-]{2,62}$/u.test(input.bucket)||
    !/^[A-Za-z0-9-]{2,48}$/u.test(input.region)||
    !input.accessKey.trim()||input.secretKey.length<16)
   throw new TypeError("Incomplete private S3 credentials");
 const client=input.fetchImpl??fetch, now=input.now??(()=>new Date());
 function url(key:string):URL {
   if(!keyPattern.test(key))throw new TypeError("Invalid private voice object key");
   const result=new URL(origin);
   result.pathname="/"+[input.bucket,...key.split("/")].map(encodeURIComponent).join("/");
   return result;
 }
 function headers(method:"PUT"|"GET"|"DELETE",target:URL,body:Buffer):Record<string,string> {
   const stamp=now().toISOString().replace(/[:-]|\.\d{3}/gu,"");
   const day=stamp.slice(0,8),scope=day+"/"+input.region+"/s3/aws4_request";
   const payload=method==="PUT"?sha256(body):sha256("");
   const signed=method==="PUT"
     ?"content-type;host;x-amz-content-sha256;x-amz-date;x-amz-server-side-encryption"
     :"host;x-amz-content-sha256;x-amz-date";
   const canonical=method==="PUT"
     ?`content-type:audio/ogg\nhost:${target.host}\nx-amz-content-sha256:${payload}\nx-amz-date:${stamp}\nx-amz-server-side-encryption:AES256\n`
     :`host:${target.host}\nx-amz-content-sha256:${payload}\nx-amz-date:${stamp}\n`;
   const request=[method,target.pathname,"",canonical,signed,payload].join("\n");
   const sig=createHmac("sha256",signingKey(input.secretKey,day,input.region))
     .update(["AWS4-HMAC-SHA256",stamp,scope,sha256(request)].join("\n")).digest("hex");
   return {
     ...(method==="PUT"?{"content-type":"audio/ogg","x-amz-server-side-encryption":"AES256"}:{}),
     "x-amz-content-sha256":payload,"x-amz-date":stamp,
     authorization:`AWS4-HMAC-SHA256 Credential=${input.accessKey}/${scope}, SignedHeaders=${signed}, Signature=${sig}`,
   };
 }
 return Object.freeze<PrivateVoiceObjectStore>({
  async put(key,bytes) {
    if(!Buffer.isBuffer(bytes)||bytes.length<84||bytes.length>1536*1024)
      throw new TypeError("Private media exceeds fixed bound");
    const target=url(key);
    const result=await client(target,{method:"PUT",headers:headers("PUT",target,bytes),
      body:new Uint8Array(bytes),redirect:"error",signal:AbortSignal.timeout(15000)});
    if(!result.ok)throw new Error("messages.voice.storage_write_failed");
  },
  async get(key,maxBytes) {
    if(maxBytes<84||maxBytes>1536*1024)throw new TypeError("Invalid private media read limit");
    const target=url(key);
    const response=await client(target,{method:"GET",headers:headers("GET",target,Buffer.alloc(0)),
      redirect:"error",signal:AbortSignal.timeout(15000)});
    if(!response.ok||!response.body)throw new Error("messages.voice.storage_read_failed");
    const reader=response.body.getReader();
    const chunks:Uint8Array[]=[];
    let size=0;
    try {
      for(;;){
        const next=await reader.read();
        if(next.done)break;
        size+=next.value.byteLength;
        if(size>maxBytes){await reader.cancel();throw new Error("messages.voice.storage_oversize");}
        chunks.push(next.value);
      }
    } finally {reader.releaseLock();}
    return Buffer.concat(chunks.map(x=>Buffer.from(x)),size);
  },
  async delete(key) {
    const target=url(key);
    const response=await client(target,{method:"DELETE",headers:headers("DELETE",target,Buffer.alloc(0)),
      redirect:"error",signal:AbortSignal.timeout(15000)});
    if(!response.ok&&response.status!==404)throw new Error("messages.voice.storage_delete_failed");
  },
 });
}
