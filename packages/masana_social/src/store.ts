import type {SocialIdentity,SocialProvider} from "./domain.js";
/** One canonical, injection-friendly persistence boundary for Gateway and PostgreSQL. */
export interface SocialStore {
  publicForCharacter(tenantId:string, characterId:string):Promise<readonly SocialIdentity[]>;
  adminForCharacter(tenantId:string, characterId:string):Promise<readonly SocialIdentity[]>;
  create(input: Readonly<{identityId:string;tenantId:string;characterId:string;actorId:string;
    provider:SocialProvider;providerAccountId:string;handle:string;publicUrl:string}>):Promise<SocialIdentity>;
  transition(input: Readonly<{tenantId:string;characterId:string;identityId:string;actorId:string;
    revision:number;action:"verify"|"publish"|"pause"|"resume"|"revoke"|"edit";
    evidenceRef?:string;providerAccountId?:string;handle?:string;publicUrl?:string}>):Promise<SocialIdentity>;
}
