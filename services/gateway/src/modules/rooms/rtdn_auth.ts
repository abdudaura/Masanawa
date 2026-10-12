import {createPublicKey,verify,type JsonWebKey} from "node:crypto";

type Json=Record<string,unknown>;
const object=(x:unknown):Json=>x!==null&&typeof x==="object"&&!Array.isArray(x)?x as Json:{};
export interface GooglePubSubAuth {
 readonly audience:string;
 readonly serviceAccountEmail:string;
 readonly http?:typeof fetch;
 readonly clock?:()=>number;
}
/** Verifies Google-signed Pub/Sub OIDC JWT, exact audience and service account. */
export function createGooglePubSubPushVerifier(input:GooglePubSubAuth){
 if(!input.audience||!input.serviceAccountEmail)throw new TypeError("rtdn_auth_config_missing");
 const clock=input.clock??Date.now,http=input.http??fetch;
 let keys:{items:Json[];expires:number}|null=null;
 const jwks="https://www.googleapis.com/oauth2/v3/certs";
 const load=async():Promise<Json[]>=>{
  if(keys&&keys.expires>clock())return keys.items;
  const r=await http(jwks,{method:"GET",redirect:"error",signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error("jwks_unavailable");
  const j=object(await r.json());
  if(!Array.isArray(j.keys))throw new Error("jwks_malformed");
  const items=j.keys.map(object);
  keys={items,expires:clock()+Math.min(3600000,300000)};
  return items;
 };
 return async function verifyPush(header:string|undefined):Promise<boolean>{
  try{
   if(!header?.startsWith("Bearer ")||header.length>10000)return false;
   const token=header.slice(7);
   const parts=token.split(".");
   if(parts.length!==3||parts.some(p=>! /^[A-Za-z0-9_-]+$/u.test(p)))return false;
   const hdr=object(JSON.parse(Buffer.from(parts[0]!,"base64url").toString("utf8")));
   const payload=object(JSON.parse(Buffer.from(parts[1]!,"base64url").toString("utf8")));
   if(hdr.alg!=="RS256"||typeof hdr.kid!=="string"||hdr.kid.length>160)return false;
   const now=Math.floor(clock()/1000);
   if(payload.aud!==input.audience||payload.email!==input.serviceAccountEmail||
     payload.email_verified!==true||!["accounts.google.com","https://accounts.google.com"].includes(String(payload.iss))||
     typeof payload.exp!=="number"||payload.exp<=now||
     typeof payload.iat!=="number"||payload.iat>now+60||payload.iat<now-7200)return false;
   const list=await load();
   const jwk=list.find(k=>k.kid===hdr.kid&&k.kty==="RSA"&&k.alg==="RS256");
   if(!jwk)return false;
   const key=createPublicKey({key:jwk as JsonWebKey,format:"jwk"});
   return verify("RSA-SHA256",Buffer.from(parts[0]+"."+parts[1]),
    key,Buffer.from(parts[2]!,"base64url"));
  }catch{return false;}
 };
}
