/**
 * Worker-side kill-switch admission for autonomous publishing/imports/teaching.
 * AF00 must wire this into the canonical events.outbox lease worker. A missing
 * database, network error or missing tenant flag is never treated as ENABLED.
 */
export type AdminJobFamily = "posting"|"teaching"|"imports"|"calls"|"paid_joins";
export interface JobFlagReader {
  read(input:{tenantId:string; family:AdminJobFamily}):Promise<boolean>;
}
export interface AdminJobAdmission {
  readonly admitted:boolean;
  readonly reason:"enabled"|"disabled"|"unavailable";
}
export async function admitAdminJob(reader:JobFlagReader|undefined, tenantId:string, family:AdminJobFamily):Promise<AdminJobAdmission> {
  if(!reader || !tenantId.trim() || !["posting","teaching","imports","calls","paid_joins"].includes(family)) return {admitted:false,reason:"unavailable"};
  try {
    return (await reader.read({tenantId,family}))
      ? {admitted:true,reason:"enabled"}
      : {admitted:false,reason:"disabled"};
  } catch {
    return {admitted:false,reason:"unavailable"};
  }
}
