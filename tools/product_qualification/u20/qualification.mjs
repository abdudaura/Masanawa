/**
 * U20 fail-closed evidence qualification. The checker never authorizes releases;
 * a separate owner must independently review actual real-world proof.
 */
export const GATES = Object.freeze([
  ...range('R',19),...range('C',8),...range('J',11),...range('K',20),
]);
const known=new Set(GATES);
const sha=/^[0-9a-f]{40}$/;
const kinds=new Set(['unit','integration','auth','privacy','database','device','provider','firebase','live-audio','restore','ci']);
const states=new Set(['PASS','FAIL','BLOCKED','NOT_RUN']);
const releaseGates=['ci','database','restore','device','firebase','provider','live-audio'];
function range(prefix,n){return Array.from({length:n},(_,i)=>prefix+String(i+1).padStart(2,'0'));}
function obj(x){return x!==null&&typeof x==='object'&&!Array.isArray(x);}
function str(x,n=512){return typeof x==='string'&&x.trim().length>0&&x.length<=n;}
function time(x){return str(x,64)&&Number.isFinite(Date.parse(x))&&/^\d{4}-\d\d-\d\dT/.test(x);}

export function requiredKinds(gate){
  if(!known.has(gate))throw new Error('unknown gate '+gate);
  const r=gate[0]==='J'||gate[0]==='K'?['integration','device']:['integration'];
  if(/^(C0[1-5]|R1[25]|K1[3-9]|K20)$/.test(gate))r.push('auth','privacy');
  if(/^(C0[1-6]|R0[5-8]|J0[4-9])$/.test(gate))r.push('database');
  if(/^(C06|R0[5-8]|J0[5-9])$/.test(gate))r.push('provider');
  if(/^(R02|R09|J01|J02)$/.test(gate))r.push('live-audio');
  return [...new Set(r)];
}
export function inspectEvidence(item,targetSha,{now=new Date().toISOString()}={}){
  const e=[];
  if(!obj(item))return ['evidence must be an object'];
  if(!kinds.has(item.kind))e.push('unknown evidence kind');
  if(!sha.test(item.sourceSha||'')||item.sourceSha!==targetSha)e.push('sourceSha must match exact targetSha');
  if(!time(item.startedAt)||!time(item.finishedAt)||
     (time(item.startedAt)&&time(item.finishedAt)&&Date.parse(item.startedAt)>Date.parse(item.finishedAt))||
     (time(item.finishedAt)&&Date.parse(item.finishedAt)>Date.parse(now)+300000))e.push('invalid execution interval');
  if(!['local','ci','staging','sandbox','device'].includes(item.environment))e.push('unknown environment');
  if(item.executed!==true)e.push('not actually executed');
  if(item.testDoubles!==false)e.push('real-path evidence requires testDoubles=false');
  if(!Number.isSafeInteger(item.exitCode)||item.exitCode!==0)e.push('nonzero or missing exitCode');
  if(!Number.isSafeInteger(item.passed)||item.passed<1||!Number.isSafeInteger(item.failed)||
     item.failed!==0||!Number.isSafeInteger(item.skipped)||item.skipped!==0)e.push('failed, skipped or absent assertions');
  if(!str(item.command,2048))e.push('missing command/procedure');
  if(!str(item.proofRef,2048))e.push('missing proofRef');
  if(!/^[0-9a-f]{64}$/.test(item.outputSha256||''))e.push('missing actual output SHA-256');
  if(!str(item.executor,128))e.push('missing executor identity');
  if(item.kind==='device'&&!str(item.deviceId,128))e.push('missing physical device reference');
  if(item.kind==='provider'&&!str(item.providerRef,128))e.push('missing sandbox/provider receipt reference');
  if(item.kind==='database'&&!str(item.databaseRef,128))e.push('missing isolated database reference');
  if(item.kind==='auth'&&!str(item.authScenario,256))e.push('missing authorized/unauthorized scenario');
  if(item.kind==='privacy'&&!str(item.privacyScenario,256))e.push('missing privacy negative test scenario');
  return e;
}
export function qualify(manifest,{now}={}){
  const errors=[];
  if(!obj(manifest))return {candidate:false,release:'BLOCKED',errors:['manifest must be object'],gates:[],summary:{}};
  if(manifest.schemaVersion!==1)errors.push('schemaVersion must be 1');
  if(!sha.test(manifest.targetSha||''))errors.push('targetSha must be full 40-char commit SHA');
  if(!obj(manifest.gates))errors.push('gates must be an object');
  if(obj(manifest.gates))for(const key of Object.keys(manifest.gates))if(!known.has(key))errors.push('unknown gate '+key);
  const gates=GATES.map(gate=>{
    const input=obj(manifest.gates)?manifest.gates[gate]:undefined;
    const reasons=[];
    if(!obj(input))reasons.push('missing gate record');
    else{
      if(!states.has(input.state))reasons.push('invalid state');
      if(!Array.isArray(input.evidence))reasons.push('evidence must be an array');
      if(input.state==='PASS'){
        if(!Array.isArray(input.evidence)||input.evidence.length===0)reasons.push('PASS without execution evidence');
        else{
          const seen=new Set();
          input.evidence.forEach((ev,i)=>{
            for(const error of inspectEvidence(ev,manifest.targetSha,{now}))reasons.push('evidence['+i+']: '+error);
            if(obj(ev)&&seen.has(ev.outputSha256))reasons.push('duplicate output checksum');
            if(obj(ev))seen.add(ev.outputSha256);
          });
          const available=new Set(input.evidence.filter(obj).map(ev=>ev.kind));
          for(const required of requiredKinds(gate))if(!available.has(required))reasons.push('missing required '+required+' evidence');
        }
      }else if(input.state==='FAIL'&&(!str(input.blocker)&&!str(input.failure)))reasons.push('FAIL requires failure explanation');
      else if(input.state==='BLOCKED'&&!str(input.blocker))reasons.push('BLOCKED requires blocker');
      else if(input.state==='NOT_RUN'&&Array.isArray(input.evidence)&&input.evidence.length)reasons.push('NOT_RUN conflicts with execution evidence');
    }
    return {gate,declared:obj(input)?input.state:'NOT_RUN',
      status:reasons.length?'INVALID':input.state==='PASS'?'EVIDENCE_CANDIDATE':input.state,reasons};
  });
  const counted=Object.fromEntries(['EVIDENCE_CANDIDATE','BLOCKED','FAIL','NOT_RUN','INVALID']
    .map(s=>[s,gates.filter(g=>g.status===s).length]));
  return {candidate:!errors.length&&counted.EVIDENCE_CANDIDATE===GATES.length,
    release:'BLOCKED',releaseRequirements:{status:'BLOCKED',missing:releaseGates,
      reason:'Provider, device, database, CI, Firebase, audio and independent release review remain mandatory.'},
    errors,gates,summary:{total:GATES.length,...counted,targetSha:manifest.targetSha||null}};
}
export function emptyManifest(commitSha){
  if(!sha.test(commitSha))throw new Error('expected exact 40-character commit SHA');
  return {schemaVersion:1,targetSha:commitSha,
    gates:Object.fromEntries(GATES.map(g=>[g,{state:'NOT_RUN',evidence:[]}]))};
}
