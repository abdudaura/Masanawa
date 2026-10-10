// AF13 read-only evidence qualification. This NEVER authorizes deployment.
// Usage: node tools/audio-first-qualification/qualify.mjs --matrix tools/audio-first-qualification/journeys.json --evidence <redacted-json> --sha <exact-40-char-SHA> --proof-root <directory>
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyEvidenceFile } from '../../tests/security/audio_first/evidence_path_guard.mjs';
const kinds=new Set(["NOT_RUN","BLOCKED","FAIL","PASS_SIMULATED","PASS_REAL"]);
function checkMatrix(matrix){
  const faults=[];
  if(matrix?.schemaVersion!==1||matrix?.contract!=="AF-v1"||!Array.isArray(matrix?.journeys)||matrix.journeys.length<1)return ["invalid AF-v1 journey matrix"];
  const seen=new Set();
  for(const j of matrix.journeys){
    if(!/^((UX|WF|PF|SA|DB)-A\d{2}|CR-A\d{2})$/.test(j.id||"")||seen.has(j.id))faults.push("duplicate/invalid journey id");
    seen.add(j.id);
    if(!Array.isArray(j.boundaries)||!j.boundaries.length||j.boundaries.some(b=>!["device","auth","gateway","database","provider","object","recovery","accessibility","offline","security","artifact"].includes(b)))faults.push("invalid boundaries "+j.id);
    if(!["release","feature"].includes(j.tier))faults.push("invalid journey tier "+j.id);
  }
  return faults;
}
function checkRecord(record,journey,sha){
  const errors=[];
  const isHash=x=>typeof x==="string"&&/^[a-f0-9]{64}$/i.test(x);
  if(!record||typeof record!=="object")return ["invalid evidence record"];
  if(!journey)return ["unknown journey"];
  if(!kinds.has(record.result))errors.push("invalid status");
  if(record.codeSha!==sha)errors.push("commit identity mismatch");
  if(!Number.isFinite(Date.parse(record.executedAt))||new Date(record.executedAt).getTime()>Date.now()+5*60000)errors.push("missing/future execution time");
  const observed=Array.isArray(record.boundaries)?record.boundaries:[];
  if(new Set(observed).size!==observed.length||observed.some(b=>!journey.boundaries.includes(b)))errors.push("invalid observed boundary");
  if(!record.environment||!["real","simulated","not_run"].includes(record.environment.mode))errors.push("missing execution mode");
  if(["FAIL","BLOCKED"].includes(record.result)&&!(typeof record.reason==="string"&&record.reason.trim().length>=8))errors.push("failure/blocker needs reason");
  if(record.result==="NOT_RUN"&&observed.length)errors.push("unrun journey cannot claim boundaries");
  if(record.result==="PASS_SIMULATED"&&record.environment?.mode!=="simulated")errors.push("simulated status must use simulated environment");
  if(record.result==="PASS_REAL"){
    if(record.environment?.mode!=="real")errors.push("real status requires real environment");
    if(journey.boundaries.some(b=>!observed.includes(b)))errors.push("missing full-boundary observation");
    if(journey.boundaries.includes("device")&&!(record.environment?.physicalDevice===true&&typeof record.environment?.deviceOS==="string"&&record.environment.deviceOS.length>1&&isHash(record.apkSha256)))errors.push("physical device and APK hash required");
    if(journey.boundaries.includes("database")&&!record.environment?.databaseRef)errors.push("database execution reference required");
    if(journey.boundaries.includes("provider")&&!record.environment?.providerRef)errors.push("external provider execution reference required");
    if(!Array.isArray(record.proofs)||record.proofs.length===0||record.proofs.some(p=>!p||!isHash(p.sha256)||typeof p.path!=="string"))errors.push("real evidence must include hashed local proof files");
    if(journey.boundaries.includes("device")&&!(Array.isArray(record.proofs)&&record.proofs.some(p=>p?.kind==="apk"&&p.sha256===record.apkSha256)))errors.push("APK must be a hashed proof artifact, not an unverified string");
    if(!record.review||typeof record.review.reviewer!=="string"||record.review.reviewer.length<2||typeof record.review.reference!=="string"||record.review.reference.length<4)errors.push("independent review reference required");
  }
  const prose=[record.reason,record.observation,record.review?.reviewer,record.review?.reference].filter(x=>typeof x==="string").join(" ");
  if(/(?:\bBearer\s+\S{12,}|-----BEGIN\s+(?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:ghp_|github_pat_)[A-Za-z0-9_]{15,}|\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b)/i.test(prose)||/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(prose))errors.push("unredacted secret or account identifier in evidence");
  return errors;
}
function assess(matrix,records,sha,verifiedProofs=new Set()){
  const failures=checkMatrix(matrix);
  if(!/^[a-f0-9]{40}$/i.test(sha||""))failures.push("expected immutable commit SHA required");
  if(!Array.isArray(records))failures.push("evidence must be an array");
  if(failures.length)return {valid:false,errors:failures,summary:{},journeys:[]};
  const ids=new Map(matrix.journeys.map(j=>[j.id,j])),seen=new Set(),byId=new Map();
  for(const r of records){
    const j=ids.get(r?.journeyId);
    const e=checkRecord(r,j,sha);
    if(seen.has(r?.journeyId))e.push("duplicate evidence journey");
    seen.add(r?.journeyId);
    if(r?.result==="PASS_REAL"&&Array.isArray(r.proofs))for(const p of r.proofs){
      if(!verifiedProofs.has(`${r.journeyId}|${p.path}|${p.sha256}`))e.push("unverified proof digest");
    }
    if(e.length)failures.push({journeyId:ids.has(r?.journeyId)?r.journeyId:"unknown",issues:e});
    else byId.set(r.journeyId,r);
  }
  const journeys=matrix.journeys.map(j=>({id:j.id,result:byId.get(j.id)?.result||"NOT_RUN",tier:j.tier,manualReviewRequired:byId.get(j.id)?.result==="PASS_REAL"}));
  const count=Object.fromEntries([...kinds].map(s=>[s,journeys.filter(j=>j.result===s).length]));
  const required=journeys.filter(j=>j.tier==="release");
  const readiness=failures.length?"INVALID":required.some(j=>j.result==="FAIL")?"FAIL":required.some(j=>j.result!=="PASS_REAL")?"BLOCKED":"REVIEW_REQUIRED";
  return {valid:failures.length===0,readiness,errors:failures,summary:{total:journeys.length,release:required.length,counts:count},journeys};
}
export {checkMatrix,checkRecord,assess};
export async function verifyProofs(records,root){
  const verified=new Set(), errors=[];
  // The proof root is operator-selected, not derived from evidence JSON.
  const base=await fs.realpath(root);
  for(const r of records){
    if(r?.result!=='PASS_REAL'||!Array.isArray(r.proofs))continue;
    for(const p of r.proofs){
      if(!p||typeof p.path!=='string'||!(/^[a-f0-9]{64}$/i).test(p.sha256||'')){
        errors.push('invalid proof descriptor');continue;
      }
      try{
        // Reuse the released, bounded, no-symlink guard. Do not build a
        // second artifact verifier with weaker path or size semantics.
        await verifyEvidenceFile(base,p.path,p.sha256.toLowerCase());
        verified.add(`${r.journeyId}|${p.path}|${p.sha256}`);
      }catch{
        // Never echo arbitrary evidence paths or attacker-supplied text.
        errors.push('missing, unsafe, changed or mismatched proof');
      }
    }
  }
  return {verified,errors};
}
async function main(args){
  const opts={};
  for(let i=0;i<args.length;i+=2){const key=args[i];if(!['--matrix','--evidence','--sha','--proof-root'].includes(key)||!args[i+1])throw Error('Usage: --matrix file --evidence file --sha commit --proof-root directory');opts[key]=args[i+1];}
  if(!opts['--matrix']||!opts['--evidence']||!opts['--sha']||!opts['--proof-root'])throw Error('All flags required');
  const matrix=JSON.parse(await fs.readFile(opts['--matrix'],'utf8'));
  const records=JSON.parse(await fs.readFile(opts['--evidence'],'utf8'));
  // A caller cannot weaken release qualification by supplying a smaller custom matrix.
  const canonicalIds=[...Array.from({length:12},(_,i)=>'UX-A'+String(i+1).padStart(2,'0')),...Array.from({length:10},(_,i)=>'WF-A'+String(i+1).padStart(2,'0')),'CR-A01',...Array.from({length:4},(_,i)=>'PF-A'+String(i+1).padStart(2,'0')),...Array.from({length:8},(_,i)=>'SA-A'+String(i+1).padStart(2,'0')),...Array.from({length:8},(_,i)=>'DB-A'+String(i+1).padStart(2,'0'))];
  if(matrix?.journeys?.length!==canonicalIds.length||canonicalIds.some(id=>!matrix.journeys.some(j=>j.id===id)))throw Error('Incomplete canonical acceptance matrix');
  // --sha is not an honor-system field: it must match this checkout's exact HEAD.
  const currentHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',timeout:5000}).trim();
  if(currentHead!==opts['--sha'])throw Error('Expected SHA does not match checked-out source');
  const proofs=await verifyProofs(Array.isArray(records)?records:[],opts['--proof-root']);
  const report=assess(matrix,records,opts['--sha'],proofs.verified);
  if(proofs.errors.length){report.valid=false;report.readiness='INVALID';report.errors.push(...proofs.errors);}
  // No raw evidence, paths, secrets, account identifiers or device details in output.
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  // No input document can cryptographically establish real-world test truth; human release review remains mandatory.
  process.exitCode=report.valid&&report.readiness==='REVIEW_REQUIRED'?3:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  main(process.argv.slice(2)).catch(()=>{process.stderr.write('AF13 qualification input unreadable or malformed; no release proof established\n');process.exitCode=2;});
}
