import type {TelegramPrivateUpdate} from "./telegram.js";
export interface AuthorizedTelegramBot {
 readonly tenantId:string;
 readonly identityId:string;
 readonly characterId:string;
 /** No token or personally identifying Telegram ID in the public projection. */
 readonly consentVersion:string;
}
export type TelegramIngestResult="duplicate"|"consent_requested"|"consented"|"revoked"|"denied"|"queued";
export interface TelegramInboxStore {
 /** Must check published, verified, platform-owned Masana + live bot permission. */
 authorizedBot(identityId:string):Promise<AuthorizedTelegramBot|null>;
 isConsented(bot:AuthorizedTelegramBot,fanHash:string):Promise<boolean>;
 /** Atomically dedupe provider update, CAS fan consent, and insert canonical events.outbox. */
 admit(bot:AuthorizedTelegramBot,update:TelegramPrivateUpdate,fanHash:string,
       encryptedRef:string|null):Promise<TelegramIngestResult>;
 /** Job-time permission and fan consent recheck; source can be disabled after enqueue. */
 canDispatch(bot:AuthorizedTelegramBot,fanHash:string):Promise<boolean>;
}
export interface TelegramPrivateContentStore {
 /** Implementation uses the existing private encrypted object store with bounded TTL and ACL. */
 /** The Telegram recipient ID remains inside the encrypted envelope; never SQL/outbox. */
 put(input:{tenantId:string;identityId:string;eventId:string;chatId:string;text:string}):Promise<string>;
 /** Delete orphaned encrypted content if consent changes or an event is duplicate. */
 discard(input:{tenantId:string;identityId:string;encryptedRef:string}):Promise<void>;
}
export interface TelegramSecretVault {
 /** Per-bot webhook secret, acquired only by trusted server-side identity; never exposed to clients. */
 webhookSecret(identityId:string):Promise<string|null>;
 fanHashKey():Promise<string>;
}
export interface TelegramMasanaDispatcher {
 /** Existing authorized fan-Masana session transport, NEVER human DM. */
 deliver(input:{tenantId:string;characterId:string;identityId:string;fanHash:string;
  eventId:string;encryptedRef:string}):Promise<"accepted"|"duplicate"|"retry">;
}
