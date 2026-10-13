import type {TeacherJob} from "@masanawa/rooms";
import type {RoomAnswerModel} from "./teacher.js";

/** Use the existing Masanawa Gemini credential pool, never client-supplied keys.
 * The worker is a server-side service. A missing provider is a deployment
 * error, not a silent queue that sends every user to staff review. */
function credentialKeys(value:unknown,depth=0):string[]{
 if(depth>8 || value===null || value===undefined)return [];
 if(typeof value==="string"){
   const v=value.trim();
   if(v.startsWith("{")||v.startsWith("[")){
     try{return credentialKeys(JSON.parse(v) as unknown,depth+1);}catch{return [];}
   }
   // Match the production Gateway secret contract: one non-empty,\n   // whitespace-free credential of at most 256 characters. The provider\n   // validates key syntax; inventing a narrower regex prevents the Rooms\n   // worker from starting with a key accepted by chat and voice.\n   return v.length>0 && v.length<=256 && !/\\s/u.test(v)?[v]:[];
 }
 if(Array.isArray(value))return value.flatMap(x=>credentialKeys(x,depth+1));
 if(typeof value==="object"){
   const record=value as Record<string,unknown>;
   return Object.entries(record).flatMap(([name,raw])=>
     /^(api[_-]?keys?|keys?|value|credentials?|secrets?|gemini)$/i.test(name)
       ? credentialKeys(raw,depth+1)
       : (raw!==null && typeof raw==="object" ? credentialKeys(raw,depth+1):[]));
 }
 return [];
}
function models(raw:string|undefined):string[]{
 if(!raw?.trim())return ["gemini-2.5-flash"];
 try{
   const value=JSON.parse(raw) as unknown;
   if(Array.isArray(value))return value.filter((x):x is string=>typeof x==="string");
 }catch{/* Existing comma-separated provider configuration. */}
 return raw.split(",");
}
function cleanModels(raw:string|undefined):string[]{
 const seen=[...new Set(models(raw).map(x=>x.trim()).filter(Boolean))];
 if(!seen.length||seen.some(m=>!/^[A-Za-z0-9_.-]{3,100}$/.test(m)))
   throw new Error("rooms_ai.models_invalid");
 return seen;
}
function resultText(payload:unknown):string{
 if(!payload||typeof payload!=="object")throw new Error("rooms_ai.empty_response");
 const candidates=(payload as {candidates?:unknown}).candidates;
 if(!Array.isArray(candidates))throw new Error("rooms_ai.empty_response");
 const first=candidates[0] as {content?:{parts?:Array<{text?:unknown;thought?:boolean}>}}|undefined;
 const texts=first?.content?.parts;
 if(!Array.isArray(texts))throw new Error("rooms_ai.empty_response");
 const result=texts.filter(p=>p?.thought!==true&&typeof p?.text==="string")
   .map(p=>p.text as string).join("").trim();
 if(!result)throw new Error("rooms_ai.empty_response");
 return result.slice(0,6000);
}
export function createGeminiRoomAnswerModel(input:{
 readonly credentialsJson?:string;
 readonly apiKey?:string;
 readonly models?:string;
 readonly fetchImpl?:typeof fetch;
}):RoomAnswerModel{
 const keys=[...new Set([
   ...credentialKeys(input.credentialsJson),
   ...credentialKeys(input.apiKey),
 ])];
 if(!keys.length)throw new Error("rooms_ai.credentials_required");
 const allowed=cleanModels(input.models);
 const fetchImpl=input.fetchImpl??fetch;
 let nextKey=0;
 return Object.freeze({
   async generate(job:TeacherJob):Promise<string>{
     // User/tenant/room are exclusively read from a locked server-side queue.
     if(!job.tenantId||!job.questionId||!job.roomId||!job.question?.trim()||
        job.question.length>2000||!job.professionTitle?.trim())
       throw new Error("rooms_ai.question_invalid");
     let lastError:unknown=new Error("rooms_ai.provider_unavailable");
     for(let i=0;i<Math.min(keys.length*allowed.length,4);i++){
       const apiKey=keys[(nextKey++)%keys.length]!;
       const model=allowed[i%allowed.length]!;
       try{
         const response=await fetchImpl(
           "https://generativelanguage.googleapis.com/v1beta/models/"+
           encodeURIComponent(model)+":generateContent",{
             method:"POST",
             headers:{"content-type":"application/json","x-goog-api-key":apiKey},
             signal:AbortSignal.timeout(25000),
             body:JSON.stringify({
               system_instruction:{parts:[{text:
                 "You are Masanawa's AI teacher. Answer the learner's question immediately "+
                 "and clearly. Do not request staff approval or pretend a person reviewed "+
                 "your answer. Stay within the Room subject when useful but do not reject "+
                 "ordinary questions for being off-topic. Respond in the learner's language "+
                 "where possible. If uncertain, say so rather than inventing facts."}]},
               contents:[{role:"user",parts:[{text:
                 "Room: "+job.professionTitle+"\nPreferred language: "+
                 job.language+"\nLearner question: "+job.question}]}],
               generationConfig:{maxOutputTokens:2048},
             }),
           });
         if(!response.ok){
           lastError=new Error("rooms_ai.provider_http_"+response.status);
           // Reject invalid credentials/config promptly; the canonical
           // outbox retains and retries questions after an operator fix.
           if(response.status===400||response.status===403||response.status===404)
             throw lastError;
           continue;
         }
         return resultText(await response.json() as unknown);
       }catch(error){
         lastError=error;
         // Don't leak prompts, credentials or external responses to logs.
         if(error instanceof Error&&/^rooms_ai\.provider_http_(400|403|404)$/.test(error.message))
           break;
       }
     }
     throw new Error("rooms_ai.provider_unavailable",{cause:lastError});
   },
 });
}
