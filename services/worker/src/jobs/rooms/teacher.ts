/** Durable Room question processor; never grants subscriptions or auto-publishes unreviewed AI answers. */
import type {TeacherJob,TeacherQueue} from "@masanawa/rooms/teacher";
export type {TeacherJob,TeacherQueue} from "@masanawa/rooms/teacher";
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
