export interface TeacherJob {
 outboxId:string;tenantId:string;questionId:string;roomId:string;fence:number;
 question:string;professionTitle:string;language:string;
}
export interface TeacherQueue {
 claim(workerId:string):Promise<TeacherJob|null>;
 publish(job:TeacherJob,answer:string):Promise<void>;
 fail(job:TeacherJob,reason:"temporary_failure"|"budget_exhausted"):Promise<void>;
}
