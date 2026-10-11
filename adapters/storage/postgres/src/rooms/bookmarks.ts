import type {Pool,PoolClient} from "pg";
import {RoomError,requireFan} from "@masanawa/rooms";
import type {RoomActor} from "@masanawa/rooms/ports";
import {assertRoom,lookupRoom,requirePublishedEligible,requireMember} from "./repository.js";

export interface SavedRoomLesson {
  readonly lessonId:string;
  readonly body:string;
  readonly kind:"lesson"|"announcement";
  readonly bookmarkedAt:string;
}
export interface RoomBookmarkStore {
  list(actor:RoomActor,roomId:string):Promise<SavedRoomLesson[]>;
  save(actor:RoomActor,roomId:string,lessonId:string):Promise<void>;
  remove(actor:RoomActor,roomId:string,lessonId:string):Promise<void>;
}
export const validLesson=(value:unknown):value is string=>
  typeof value==="string" && /^room-lesson_[a-zA-Z0-9-]{8,100}$/u.test(value);
function ids(actor:RoomActor,roomId:string,lessonId?:string):string {
  assertRoom(roomId);
  if(!actor.tenantId || actor.tenantId.length>128)throw new RoomError(401,"not_authorized");
  if(lessonId!==undefined&&!validLesson(lessonId))throw new RoomError(422,"invalid_lesson_id");
  return requireFan(actor.userId);
}
async function tx<T>(pool:Pool,fn:(q:PoolClient)=>Promise<T>):Promise<T>{
  const q=await pool.connect();
  try {
    await q.query("BEGIN");
    const result=await fn(q);
    await q.query("COMMIT");
    return result;
  } catch(error) {
    await q.query("ROLLBACK");
    throw error;
  } finally {q.release();}
}
async function admission(q:PoolClient,actor:RoomActor,roomId:string):Promise<void>{
  // Reuse the exact J07/J08 membership and verified-Play entitlement authorities.
  const room=await lookupRoom(q,actor.tenantId,roomId);
  await requirePublishedEligible(q,actor,room);
  await requireMember(q,actor,roomId);
}
export function createPgRoomBookmarkStore(pool:Pool):RoomBookmarkStore {
  return {
    async list(actor,roomId) {
      const userId=ids(actor,roomId);
      return tx(pool,async q=>{
        await admission(q,actor,roomId);
        const result=await q.query(
          "SELECT l.lesson_id,l.body,l.kind,b.bookmarked_at FROM rooms.lesson_bookmarks b "+
          "JOIN rooms.lessons l ON l.tenant_id=b.tenant_id AND l.lesson_id=b.lesson_id AND l.room_id=b.room_id "+
          "WHERE b.tenant_id=$1 AND b.room_id=$2 AND b.user_id=$3 "+
          "AND l.state='published' AND (l.publish_at IS NULL OR l.publish_at<=now()) "+
          "ORDER BY b.bookmarked_at DESC,l.lesson_id DESC LIMIT 100",
          [actor.tenantId,roomId,userId]
        );
        return result.rows.map((r:Record<string,unknown>):SavedRoomLesson=>({
          lessonId:String(r.lesson_id),body:String(r.body),
          kind:r.kind==="announcement"?"announcement":"lesson",
          bookmarkedAt:new Date(r.bookmarked_at as string|Date).toISOString(),
        }));
      });
    },
    async save(actor,roomId,lessonId) {
      const userId=ids(actor,roomId,lessonId);
      await tx(pool,async q=>{
        await admission(q,actor,roomId);
        const lesson=await q.query(
          "SELECT 1 FROM rooms.lessons WHERE tenant_id=$1 AND room_id=$2 AND lesson_id=$3 "+
          "AND state='published' AND (publish_at IS NULL OR publish_at<=now())",
          [actor.tenantId,roomId,lessonId]
        );
        if(lesson.rows.length!==1)throw new RoomError(404,"lesson_unavailable");
        await q.query(
          "INSERT INTO rooms.lesson_bookmarks (tenant_id,room_id,user_id,lesson_id) "+
          "VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,room_id,user_id,lesson_id) DO NOTHING",
          [actor.tenantId,roomId,userId,lessonId]
        );
      });
    },
    async remove(actor,roomId,lessonId) {
      const userId=ids(actor,roomId,lessonId);
      // Deleting one's own private pointer remains possible after paid access expires.
      // It does not reveal lesson content or a foreign bookmark's existence.
      await pool.query(
        "DELETE FROM rooms.lesson_bookmarks WHERE tenant_id=$1 AND room_id=$2 AND user_id=$3 AND lesson_id=$4",
        [actor.tenantId,roomId,userId,lessonId]
      );
    },
  };
}
