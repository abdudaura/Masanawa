import {generateKeyPairSync,sign} from "node:crypto";
import {describe,it,expect,vi} from "vitest";
import {createGooglePubSubPushVerifier} from "./rtdn_auth.js";
const keys=generateKeyPairSync("rsa",{modulusLength:2048});
const jwk=keys.publicKey.export({format:"jwk"});
const aud="https://api.masanawa.com/v1/webhooks/play";
const email="rtdn@example.iam.gserviceaccount.com";
function jwt(claims:Record<string,unknown>):string {
 const encode=(v:Record<string,unknown>)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const content=encode({alg:"RS256",kid:"test-key"})+"."+encode(claims);
 return content+"."+sign("RSA-SHA256",Buffer.from(content),keys.privateKey).toString("base64url");
}
const now=Date.parse("2026-10-11T00:00:00Z");
const claims={iss:"https://accounts.google.com",aud,email,email_verified:true,
 iat:now/1000-10,exp:now/1000+3600};
const http=vi.fn(async()=>new Response(JSON.stringify({keys:[{...jwk,alg:"RS256",kid:"test-key"}]}),{status:200}));
describe("RTDN Google signed PubSub OIDC",()=>{
 it("accepts only Google-signed service-account identity and matching audience",async()=>{
  const verifier=createGooglePubSubPushVerifier({audience:aud,serviceAccountEmail:email,http:http as typeof fetch,clock:()=>now});
  expect(await verifier("Bearer "+jwt(claims))).toBe(true);
  expect(await verifier("Bearer "+jwt({...claims,aud:"https://attacker.test"}))).toBe(false);
  expect(await verifier("Bearer "+jwt({...claims,email:"evil@example.com"}))).toBe(false);
  expect(await verifier("Bearer "+jwt({...claims,email_verified:false}))).toBe(false);
  expect(await verifier("Bearer "+jwt({...claims,exp:now/1000-1}))).toBe(false);
  expect(await verifier("Bearer "+jwt({...claims,iss:"https://attacker.test"}))).toBe(false);
 });
 it("rejects unsigned, damaged or missing bearer tokens",async()=>{
  const verifier=createGooglePubSubPushVerifier({audience:aud,serviceAccountEmail:email,http:http as typeof fetch,clock:()=>now});
  expect(await verifier(undefined)).toBe(false);
  expect(await verifier("Bearer one.two.three")).toBe(false);
  const good=jwt(claims);
  expect(await verifier("Bearer "+good.slice(0,-1)+"x")).toBe(false);
 });
 it("rejects alternate signature text that decodes to the same bytes",async()=>{
  const verifier=createGooglePubSubPushVerifier({audience:aud,serviceAccountEmail:email,http:http as typeof fetch,clock:()=>now});
  const token=jwt(claims),parts=token.split("."),signature=parts[2]!;
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const alias=signature.slice(0,-1)+alphabet[alphabet.indexOf(signature.at(-1)!)+1];
  expect(Buffer.from(alias,"base64url")).toEqual(Buffer.from(signature,"base64url"));
  expect(await verifier("Bearer "+parts[0]+"."+parts[1]+"."+alias)).toBe(false);
 });
});
