import type { VoiceNoteAuthorizer } from "./service.js";
import { createPrivateVoiceNoteService } from "./service.js";
import { createPostgresVoiceNoteRepository, type VoiceSqlPool } from "./postgres_repository.js";
import { createPrivateVoiceS3 } from "./private_s3.js";

/** C04's independently testable composition, ready for the single Gateway integration owner.
 * Production must fail closed on partial private S3 configuration.
 */
export function composeHumanVoiceNotes(input:Readonly<{
  pool:VoiceSqlPool;
  authorizer:VoiceNoteAuthorizer;
  privateS3:{
   endpoint:string;region:string;bucket:string;accessKey:string;secretKey:string;
  };
}>) {
 if(Object.values(input.privateS3).some(x=>typeof x!=="string"||!x.trim()))
   throw new TypeError("Complete private human voice S3 configuration is required");
 return createPrivateVoiceNoteService({
  authorizer:input.authorizer,
  repository:createPostgresVoiceNoteRepository(input.pool),
  objects:createPrivateVoiceS3(input.privateS3),
 });
}
