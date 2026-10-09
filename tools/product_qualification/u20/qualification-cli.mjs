#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {qualify,emptyManifest,GATES} from './qualification.mjs';

function usage(){
  console.error('Usage: node qualification-cli.mjs --init <40-char-sha> [--out file] | --check <manifest.json> [--out file] | --gates');
  process.exitCode=2;
}
const args=process.argv.slice(2);
function option(name){
  const found=args.flatMap((v,i)=>v===name?[i]:[]);
  if(found.length>1)throw new Error('duplicate '+name);
  return found.length===1?args[found[0]+1]:undefined;
}
try{
  const modes=['--init','--check','--gates'].filter(x=>args.includes(x));
  if(modes.length!==1)usage();
  else{
    const allowed=modes[0]==='--gates'?['--gates']:[modes[0],'--out'];
    for(let i=0;i<args.length;i++){
      if(!allowed.includes(args[i]))throw new Error('unknown argument '+args[i]);
      if(args[i]!=='--gates')i++;
    }
    let result;
    if(modes[0]==='--gates')result=GATES;
    else if(modes[0]==='--init')result=emptyManifest(option('--init'));
    else result=qualify(JSON.parse(readFileSync(resolve(option('--check')),'utf8')));
    const output=JSON.stringify(result,null,2)+'\n';
    if(option('--out'))writeFileSync(resolve(option('--out')),output,{flag:'wx'});
    else process.stdout.write(output);
    if(modes[0]==='--check'&&(!result.candidate||result.release!=='APPROVED'))process.exitCode=1;
  }
}catch(error){console.error('U20 evidence error: '+error.message);process.exitCode=2;}
