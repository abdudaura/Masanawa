import { ArtifactError } from './model.js';
import type { Owner, ArtifactRepository } from './model.js';
import type { ArtifactService } from './service.js';

/** Structural subset of U02 #520 OperatorActor/Record. Avoid a second task engine or protocol. */
type Actor = Owner & {sessionDigest:string};
type Task = Owner & {taskId:string;operationId:string|null;capabilityId:string;capabilityVersion:number;scope:string;phase:string};
type Outcome = {status:'confirmed';receiptRef:string}|{status:'rejected';code:string}|{status:'unknown'};
export function createArtifactTaskAdapter(input:{
  service:ArtifactService;repository:ArtifactRepository;
  readTask:(input:{actor:Actor;taskId:string})=>Promise<Task|null>;
}) {
  async function admitted(actor:Actor,taskId:string) {
    if (!/^[a-f0-9]{64}$/.test(actor.sessionDigest)) throw new ArtifactError('unauthorized',401);
    const task=await input.readTask({actor,taskId});
    if (!task || task.taskId!==taskId || task.userId!==actor.userId || task.tenantId!==actor.tenantId ||
      task.scope!=='private-assistant' || task.capabilityId!=='files.create' || task.capabilityVersion!==1 ||
      !['running','reconciling'].includes(task.phase) ||
      !/^operation_[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(task.operationId??'')) {
      throw new ArtifactError('task_not_admitted',403);
    }
    return {task,requestId:'request_'+task.operationId!.slice('operation_'.length)};
  }
  return {
    /** Called by the admitted U04 executor with actual generated text, not a claimed file URL. */
    async persist(actor:Actor,taskId:string,document:{filename:string;text:string;ttlSeconds:number}) {
      const {task,requestId}=await admitted(actor,taskId);
      return input.service.generatedText(actor,{...document,requestId},taskId,task.operationId!);
    },
    /** Readback only: never regenerates, uploads or re-executes the task. Matches U02 domain outcome. */
    async reconcile(actor:Actor,taskId:string):Promise<Outcome> {
      const {task,requestId}=await admitted(actor,taskId);
      const row=await input.repository.findRequest(actor,requestId);
      if (!row) return {status:'unknown'};
      if (row.provenance.kind!=='operator' || row.provenance.taskId!==taskId || row.provenance.operationId!==task.operationId) {
        return {status:'rejected',code:'ARTIFACT_PROVENANCE_CONFLICT'};
      }
      if (['deleted','deleting','revoked'].includes(row.state)) return {status:'rejected',code:'ARTIFACT_UNAVAILABLE'};
      try {
        await input.service.recover(actor,row.id);
        const ticket=await input.service.ticket(actor,row.id);
        await input.service.download(actor,row.id,ticket.ticket);
        await admitted(actor,taskId); // A cancelled/reassigned task during readback cannot be completed.
        return {status:'confirmed',receiptRef:row.id};
      } catch {return {status:'unknown'};}
    },
  };
}
