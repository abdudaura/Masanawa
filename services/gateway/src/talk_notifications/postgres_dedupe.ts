import type { TalkPushDedupeRepository } from "./delivery.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface TalkPushDedupeSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

export interface PostgresTalkPushDedupeRepository extends TalkPushDedupeRepository {
  purgeExpired(input: Readonly<{ before: string; limit: number }>): Promise<number>;
}

function text(value:string,name:string,max:number):string{
  if(typeof value!=="string") throw new TypeError(`${name} is invalid`);
  const normalized=value.trim();
  if(!normalized || normalized.length>max) throw new TypeError(`${name} is invalid`);
  return normalized;
}
function iso(value:string,name:string):string{
  const parsed=Date.parse(value);
  if(!Number.isFinite(parsed)) throw new TypeError(`${name} is invalid`);
  return new Date(parsed).toISOString();
}
function positiveInteger(value:number,name:string,min:number,max:number):number{
  if(!Number.isSafeInteger(value) || value<min || value>max){
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function createPostgresTalkPushDedupeRepository(
  pool:TalkPushDedupeSqlPool,
  options:Readonly<{retentionDays?:number}>={},
):PostgresTalkPushDedupeRepository{
  const retentionDays=positiveInteger(
    options.retentionDays ?? 30,
    "retentionDays",
    1,
    365,
  );

  return Object.freeze({
    async claim(input){
      const tenantId=text(input.tenantId,"tenantId",256);
      const userId=text(input.userId,"userId",256);
      const dedupeKey=text(input.dedupeKey,"dedupeKey",600);
      const claimedAt=iso(input.createdAt,"createdAt");
      const expiresAt=new Date(
        Date.parse(claimedAt)+retentionDays*24*60*60*1000,
      ).toISOString();

      const result=await pool.query<{dedupe_key:string}>(
        `INSERT INTO talks.push_dedupe(
           tenant_id,user_id,dedupe_key,claimed_at,expires_at
         ) VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(tenant_id,user_id,dedupe_key) DO NOTHING
         RETURNING dedupe_key`,
        [tenantId,userId,dedupeKey,claimedAt,expiresAt],
      );
      return result.rows.length===1;
    },

    async purgeExpired(input){
      const before=iso(input.before,"before");
      const limit=positiveInteger(input.limit,"limit",1,10_000);
      const result=await pool.query<{dedupe_key:string}>(
        `WITH expired AS (
           SELECT tenant_id,user_id,dedupe_key
             FROM talks.push_dedupe
            WHERE expires_at <= $1
            ORDER BY expires_at ASC
            LIMIT $2
         )
         DELETE FROM talks.push_dedupe d
          USING expired e
          WHERE d.tenant_id=e.tenant_id
            AND d.user_id=e.user_id
            AND d.dedupe_key=e.dedupe_key
         RETURNING d.dedupe_key`,
        [before,limit],
      );
      return result.rows.length;
    },
  });
}
