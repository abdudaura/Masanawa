import { createCanonicalId, parseCanonicalId, type CanonicalIdKind } from '@masanawa/contracts';
import { createArtifactService } from './service.js';
import { createArtifactCreationLimiter, createArtifactRepository, sweepArtifacts, type QueryPort } from './postgres.js';
import type { ArtifactObjectStore, Owner } from './model.js';

/** Explicit adapters are mandatory: no always-allow contact, task or quota default. */
export function composeWorkArtifacts(input:{
  db:QueryPort; objects:ArtifactObjectStore; ticketSecret:Buffer;
  canShare:(owner:Owner,recipient:string)=>Promise<boolean>;
  authorizeTask:(owner:Owner,taskId:string,operationId:string)=>Promise<boolean>;
  admitCreation:(owner:Owner)=>Promise<boolean>;
}) {
  const repository=createArtifactRepository(input.db);
  const dailyLimit=createArtifactCreationLimiter(input.db);
  const artifacts=createArtifactService({...input,repository,
    admitCreation:async(owner)=>await input.admitCreation(owner) && await dailyLimit(owner),
    createId:()=>createCanonicalId('media-artifact'),
    assertId:(kind,value)=>{parseCanonicalId(kind as CanonicalIdKind,value);}});
  return {artifacts,sweep:()=>sweepArtifacts(repository,artifacts.remove,input.objects.delete)};
}
