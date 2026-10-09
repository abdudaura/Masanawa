import { DmPreferenceError,hintForEvent,requireConversationId,requireEventId,validateChange,type DmEvent,type DmNotificationChange,type DmNotificationPreference,type DmPushHint } from "./policy.js";

export interface HumanDmIdentity { readonly tenantId:string; readonly userId:string }
export interface HumanDmPreferenceAuthorizer {
  authorize(input:{readonly authorizationHeader:string|undefined}):Promise<HumanDmIdentity>;
}
export interface HumanDmPreferenceRepository {
  get(scope:HumanDmIdentity&{readonly conversationId:string}):Promise<DmNotificationPreference|null>;
  set(scope:HumanDmIdentity&{readonly conversationId:string;readonly change:DmNotificationChange}):Promise<DmNotificationPreference|"conflict"|null>;
  unreadCount(scope:HumanDmIdentity):Promise<string>;
  /** Requires C03 recipient event, current C02 access, and an unread undeleted message. */
  eligibleEvent(scope:HumanDmIdentity&{readonly event:DmEvent}):Promise<DmNotificationPreference|null>;
  /** Durable at-most-once hint claim, with a second unread/mute/access check. */
  reserveHint(scope:HumanDmIdentity&{readonly event:DmEvent}):Promise<boolean>;
}
export interface HumanDmPreferenceService {
  get(input:{readonly authorizationHeader?:string;readonly conversationId:string}):Promise<DmNotificationPreference>;
  unread(input:{readonly authorizationHeader?:string}):Promise<{readonly unreadCount:string}>;
  set(input:{readonly authorizationHeader?:string;readonly conversationId:string;readonly change:DmNotificationChange}):Promise<DmNotificationPreference>;
  /** Trusted R14 worker only, after C03 commit; never expose as a public route. */
  pushHint(input:{readonly recipient:HumanDmIdentity;readonly event:DmEvent}):Promise<DmPushHint|null>;
  resolveTarget(input:{readonly authorizationHeader?:string;readonly conversationId:string}):Promise<{readonly conversationId:string}>;
}
export function createHumanDmPreferenceService(input:{
  readonly authorizer:HumanDmPreferenceAuthorizer;
  readonly repository:HumanDmPreferenceRepository;
  readonly now?:()=>Date;
}):HumanDmPreferenceService {
  const now=input.now??(()=>new Date());
  async function principal(header:string|undefined):Promise<HumanDmIdentity>{
    const user=await input.authorizer.authorize({authorizationHeader:header});
    if(!user.tenantId||!user.userId)throw new DmPreferenceError("messages.authentication_required",401);
    return {tenantId:user.tenantId,userId:user.userId};
  }
  async function unchanged(header:string|undefined,initial:HumanDmIdentity):Promise<void>{
    const again=await principal(header);
    if(again.tenantId!==initial.tenantId||again.userId!==initial.userId)throw new DmPreferenceError("messages.session_changed",401);
  }
  async function get(header:string|undefined,conversationId:string):Promise<DmNotificationPreference>{
    const conversation=requireConversationId(conversationId),scope=await principal(header);
    const result=await input.repository.get({...scope,conversationId:conversation});
    await unchanged(header,scope);
    if(!result)throw new DmPreferenceError("messages.conversation_unavailable",404);
    return result;
  }
  const service:HumanDmPreferenceService={
    async get({authorizationHeader,conversationId}){return get(authorizationHeader,conversationId);},
    async unread({authorizationHeader}){
      const scope=await principal(authorizationHeader);
      const unreadCount=await input.repository.unreadCount(scope);
      await unchanged(authorizationHeader,scope);
      if(!/^(0|[1-9][0-9]*)$/.test(unreadCount))throw new DmPreferenceError("messages.unread_invalid",500);
      return {unreadCount};
    },
    async set({authorizationHeader,conversationId,change}){
      const conversation=requireConversationId(conversationId),validated=validateChange(change,now());
      const scope=await principal(authorizationHeader);
      const result=await input.repository.set({...scope,conversationId:conversation,change:validated});
      await unchanged(authorizationHeader,scope);
      if(result===null)throw new DmPreferenceError("messages.conversation_unavailable",404);
      if(result==="conflict")throw new DmPreferenceError("messages.preference_version_conflict",409);
      return result;
    },
    async pushHint({recipient,event}){
      if(event.recipientUserId!==recipient.userId || event.actorUserId===recipient.userId)return null;
      const clean={...event,conversationId:requireConversationId(event.conversationId),eventId:requireEventId(event.eventId)};
      const preference=await input.repository.eligibleEvent({...recipient,event:clean});
      if(!preference)return null;
      if(preference.muteMode==="forever" ||
        (preference.muteMode==="until" && preference.mutedUntil && Date.parse(preference.mutedUntil)>now().getTime()))return null;
      if(!await input.repository.reserveHint({...recipient,event:clean}))return null;
      return hintForEvent(clean);
    },
    async resolveTarget({authorizationHeader,conversationId}){
      const result=await get(authorizationHeader,conversationId);
      return {conversationId:result.conversationId};
    },
  };
  return Object.freeze(service);
}
