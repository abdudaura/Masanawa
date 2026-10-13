/** AI answers go straight to the signed-in Room users; no routine staff review. */
import type {TeacherJob,TeacherQueue} from "@masanawa/rooms";
export type {TeacherJob,TeacherQueue} from "@masanawa/rooms";
export interface RoomAnswerModel {generate(job:TeacherJob):Promise<string>;}
export function createRoomTeacherWorker(
  queue:TeacherQueue,model:RoomAnswerModel,workerId:string,enabled:()=>boolean,
){
 if(!workerId.trim()||workerId.length>128)throw new Error("worker_id_required");
 return Object.freeze({
   async tick():Promise<"disabled"|"idle"|"processed"|"retry">{
     if(!enabled())return "disabled";
     const job=await queue.claim(workerId);
     if(!job)return "idle";
     try{
       const answer=(await model.generate(job)).trim();
       if(!answer)throw new Error("rooms_ai.empty_reply");
       await queue.publish(job,answer.slice(0,6000));
       return "processed";
     }catch{
       await queue.fail(job,"temporary_failure");return "retry";
     }
   }
 });
}
