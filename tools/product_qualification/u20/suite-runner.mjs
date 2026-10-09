#!/usr/bin/env node
/** U20 explicitly allowlisted local verification. No arbitrary shell strings. */
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';

export const SUITES=Object.freeze({
 'contracts':['pnpm',['test:contracts']],
 'security':['pnpm',['test:security']],
 'recovery':['pnpm',['test:recovery']],
 'architecture':['pnpm',['test:architecture']],
 'flutter':['flutter',['test','--reporter','expanded']],
});
export function safeEnv(env){
 const out={};
 const sensitive=/(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY|DATABASE_URL|FLUTTERWAVE|NOWPAYMENTS|STRIPE|RAILWAY|SUPABASE|FIREBASE|PRODUCTION|GOOGLE_APPLICATION_CREDENTIALS)/i;
 for(const [key,value] of Object.entries(env))if(!sensitive.test(key)&&typeof value==='string')out[key]=value;
 out.NODE_ENV='test';out.MASANAWA_U20_NO_PRODUCTION='1';
 return out;
}
export function parseCount(output){
 const line=output.split(/\r?\n/).findLast(s=>/\bTests\b/.test(s)&&/\bpassed\b/.test(s));
 if(!line)return {passed:null,failed:null,skipped:null};
 const n=label=>{const re=new RegExp('\\b(\\d+)\\s+'+label+'\\b');const hit=line.match(re);return hit?Number(hit[1]):0;};
 return {passed:n('passed'),failed:n('failed'),skipped:n('skipped')};
}
export function runSuite(name,repo,{spawn=spawnSync,env=process.env}={}){
 if(!Object.hasOwn(SUITES,name))throw new Error('unrecognized suite: '+name);
 const root=resolve(repo);
 if(!existsSync(join(root,'package.json')))throw new Error('repository package.json missing');
 const [binary,args]=SUITES[name];
 const cwd=name==='flutter'?join(root,'apps/mobile'):root;
 if(name==='flutter'&&!existsSync(join(cwd,'pubspec.yaml')))throw new Error('Flutter app missing');
 const begin=new Date().toISOString();
 const result=spawn(binary,args,{cwd,env:safeEnv(env),shell:false,encoding:'utf8',
   maxBuffer:20*1024*1024,timeout:10*60*1000});
 const end=new Date().toISOString();
 const output=(result.stdout||'')+'\n'+(result.stderr||'');
 const counts=parseCount(output);
 return {suite:name,command:[binary,...args],environment:'local',startedAt:begin,
   finishedAt:end,exitCode:result.status??-1,executed:!result.error,
   proofKind:'automated-command-output',outputSha256:createHash('sha256').update(output).digest('hex'),
   outputBytes:Buffer.byteLength(output),counts,processError:result.error?.message||null,
   testDoublesReviewed:false,qualifiesAsReleaseProof:false};
}
function usage(){
 console.error('Usage: node suite-runner.mjs <contracts|security|recovery|architecture|flutter> <repo-root> <new-output-json>');
 process.exitCode=2;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 if(process.argv.length!==5)usage();
 else try{
   const report=runSuite(process.argv[2],process.argv[3]);
   writeFileSync(resolve(process.argv[4]),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
   console.log('Suite '+report.suite+': '+(report.executed?'exit '+report.exitCode:'not executed')+
     '; candidate only; no release proof.');
   if(!report.executed||report.exitCode!==0||(report.counts.failed??0)>0)process.exitCode=1;
 }catch(error){console.error('U20 run rejected: '+error.message);process.exitCode=2;}
}
