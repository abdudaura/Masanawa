/** C18 v1: no LiveKit token, room name or other fan data in history readback. */
export type HistoryState = "connecting" | "active" | "ended" | "failed" | "expired";
export interface HistoryEntry {
  callId:string; characterId:string; displayName:string; state:HistoryState;
  createdAt:string; startedAt:string|null; endedAt:string|null; durationSeconds:number;
}
export interface HistoryPage {schemaVersion:1;items:HistoryEntry[];nextCursor:string|null;}
export class HistoryFault extends Error {
  constructor(readonly code:string,readonly status:number){super(code);}
}
const callIdPattern=/^call_[0-9a-f-]{36}$/i;
export function readHistoryPageSize(value:unknown):number{
  if(value===undefined)return 20;
  if(typeof value!=="string" || !/^[1-9][0-9]?$/.test(value) ||
    Number(value)>30)throw new HistoryFault("invalid_page_size",422);
  return Number(value);
}
export function readHistoryCursor(value:unknown):{createdAt:string;callId:string}|null{
  if(value===undefined)return null;
  if(typeof value!=="string" || value.length>100)throw new HistoryFault("invalid_cursor",422);
  const i=value.indexOf("|");
  if(i!==24)throw new HistoryFault("invalid_cursor",422);
  const createdAt=value.slice(0,i),callId=value.slice(i+1);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt) ||
      !Number.isFinite(Date.parse(createdAt)) ||
      new Date(createdAt).toISOString()!==createdAt ||
      !callIdPattern.test(callId))
    throw new HistoryFault("invalid_cursor",422);
  return {createdAt,callId};
}
export function makeHistoryCursor(createdAt:string,callId:string):string{
  const parsed=readHistoryCursor(createdAt+"|"+callId);
  if(!parsed)throw new HistoryFault("invalid_cursor",422);
  return createdAt+"|"+callId;
}
