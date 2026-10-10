/** Durable Room question processor; never grants subscriptions or auto-publishes unreviewed AI answers. */
export interface TeacherJob {
 outboxId:string;tenantId:string;questionId:string;roomId:string;fence:number;
}
export interface TeacherQueue {
 claim(workerId:string):Promise<TeacherJob|null>;
 /** An answer is a DRAFT. Staff review is required for public visibility. */
 draft(job:TeacherJob,answer:string|null):Promise<void>;
 fail(job:TeacherJob,reason:"temporary_failure"|"budget_exhausted"):Promise<void>;
}
export interface RoomAnswerModel {
 generate(input:{tenantId:string;roomId:string;questionId:string}):Promise<string|null>;
}
export function createRoomTeacherWorker(queue:TeacherQueue,model:RoomAnswerModel,workerId:string,enabled:()=>boolean){
 if(!workerId||workerId.length>128)throw new Error("worker_id_required");
 return Object.freeze({
   async tick():Promise<"disabled"|"idle"|"processed"|"retry">{
     if(!enabled())return "disabled";
     const job=await queue.claim(workerId);
     if(!job)return "idle";
     try{
       // An unavailable provider is handled by a staff review queue. No question
       // is dropped merely because its Room currently has a single student.
       const answer=await model.generate({tenantId:job.tenantId,roomId:job.roomId,questionId:job.questionId});
       await queue.draft(job,answer&&answer.trim()?answer.trim().slice(0,6000):null);
       return "processed";
     }catch{
       await queue.fail(job,"temporary_failure");return "retry";
     }
   }
 });
}
