/** Verified server-only Telegram Bot API approval; no access token may leave vault. */
export interface VerifiedTelegramBotCredential {
 readonly botId:string; readonly username:string;
 readonly authorizationRef:string;readonly evidenceRef:string;
 readonly checkedAt:string; readonly expiresAt:string;
}
export interface TelegramCredentialVerifier {
 verify(input:{tenantId:string;identityId:string;credentialAlias:string}):
  Promise<VerifiedTelegramBotCredential>;
}
export interface TelegramAuthorizationStore {
 authorize(input:{tenantId:string;actorId:string;characterId:string;identityId:string;
  revision:number;bot:VerifiedTelegramBotCredential}):
  Promise<{identityId:string;revision:number;mode:"verified_automation_eligible";expiresAt:string}>;
}
/** The credential is privately provisioned by ops; alias is safe to enter in Admin. */
export interface TelegramBotVault {
 get(input:{tenantId:string;identityId:string;alias:string}):
  Promise<{token:string;authorizationRef:string;evidenceRef:string;webhookSecretConfigured:boolean}|null>;
}
