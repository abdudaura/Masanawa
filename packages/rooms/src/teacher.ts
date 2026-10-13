export interface TeacherJob {
 outboxId:string;tenantId:string;questionId:string;roomId:string;fence:number;
}
export interface TeacherQueue {
 claim(workerId:string):Promise<TeacherJob|null>;
 draft(job:TeacherJob,answer:string|null):Promise<void>;
 fail(job:TeacherJob,reason:"temporary_failure"|"budget_exhausted"):Promise<void>;
}
