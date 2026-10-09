/** Private human DM notification policy. Push messages never carry sender or content. */
export type PreviewMode = "hidden" | "generic";
export type MuteMode = "off" | "until" | "forever";
export interface DmNotificationPreference {
  readonly conversationId: string;
  readonly version: number;
  readonly muteMode: MuteMode;
  readonly mutedUntil: string | null;
  readonly preview: PreviewMode;
}
export interface DmNotificationChange {
  readonly expectedVersion: number;
  readonly muteMode: MuteMode;
  readonly mutedUntil?: string | null;
  readonly preview: PreviewMode;
}
export interface DmEvent {
  readonly eventId: string;
  readonly conversationId: string;
  readonly recipientUserId: string;
  readonly actorUserId: string;
  readonly messageId: string;
}
export interface DmPushHint {
  readonly title: "New message";
  readonly body: "Open Masanawa to view your messages";
  readonly data: Readonly<{ readonly kind:"human_dm_hint"; readonly conversationId:string; readonly eventId:string }>;
}
export class DmPreferenceError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code); this.name="DmPreferenceError";
  }
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireConversationId(value: string): string {
  if(typeof value!=="string" || !UUID.test(value)) throw new DmPreferenceError("messages.conversation_invalid",400);
  return value.toLowerCase();
}
export function requireEventId(value: string): string {
  if(typeof value!=="string" || !/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value)>9223372036854775807n) {
    throw new DmPreferenceError("messages.event_invalid",400);
  }
  return value;
}
export function validateChange(change:DmNotificationChange,now:Date):DmNotificationChange {
  if(!Number.isSafeInteger(change.expectedVersion) || change.expectedVersion<0 || change.expectedVersion>2147483646 ||
     !["hidden","generic"].includes(change.preview) ||
     !["off","until","forever"].includes(change.muteMode)) {
    throw new DmPreferenceError("messages.notification_preferences_invalid",400);
  }
  if(change.muteMode==="until"){
    if(typeof change.mutedUntil!=="string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(change.mutedUntil)){
      throw new DmPreferenceError("messages.mute_expiry_invalid",400);
    }
    const epoch=Date.parse(change.mutedUntil);
    if(!Number.isFinite(epoch) || epoch-now.getTime()<60_000 || epoch-now.getTime()>366*86400_000){
      throw new DmPreferenceError("messages.mute_expiry_invalid",400);
    }
  } else if(change.mutedUntil!==undefined && change.mutedUntil!==null){
    throw new DmPreferenceError("messages.mute_expiry_invalid",400);
  }
  return Object.freeze({expectedVersion:change.expectedVersion,muteMode:change.muteMode,
    mutedUntil:change.muteMode==="until"?change.mutedUntil:null,preview:change.preview});
}
export function isMuted(preference:DmNotificationPreference,now:Date):boolean {
  if(preference.muteMode==="forever")return true;
  if(preference.muteMode!=="until" || !preference.mutedUntil)return false;
  return Date.parse(preference.mutedUntil)>now.getTime();
}
/** Sender/message/user/media data intentionally omitted, even for generic preview. */
export function hintForEvent(event:Pick<DmEvent,"conversationId"|"eventId">):DmPushHint {
  return Object.freeze({title:"New message",body:"Open Masanawa to view your messages",
    data:Object.freeze({kind:"human_dm_hint",conversationId:requireConversationId(event.conversationId),eventId:requireEventId(event.eventId)})});
}
