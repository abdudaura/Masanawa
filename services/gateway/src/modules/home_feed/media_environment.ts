import { createReplayObjectStore } from "../../talk_replay/playback/s3_object_store.js";
import type { StatusMediaConfiguration } from "./media_runtime.js";

/** Use an explicitly configured Status store, never infer replay or avatar buckets.
 * Missing configuration leaves private media unavailable rather than fabricating
 * approved URLs. Secrets remain on the server. */
export function createConfiguredStatusMedia(
 env: Readonly<Record<string,string|undefined>>,
): StatusMediaConfiguration | undefined {
 const prefix="MASANAWA_STATUS_MEDIA_";
 const names=["S3_ENDPOINT","S3_REGION","S3_BUCKET","S3_ACCESS_KEY","S3_SECRET_KEY","DOWNLOAD_ORIGIN"] as const;
 const entries=names.map(name=>env[prefix+name]?.trim());
 if(entries.every(value=>!value))return undefined;
 if(entries.some(value=>!value)){
  throw new TypeError("Status media storage configuration incomplete");
 }
 const [endpoint,region,bucket,accessKey,secret,origin]=entries as string[];
 const objects=createReplayObjectStore({
  endpoint,region,bucket,accessKey,secret,
  maxObjectBytes:30*1024*1024,
 });
 if(!objects.statObject)throw new TypeError("Status media metadata support unavailable");
 return {
  objects:{presignGet:objects.presignGet,statObject:objects.statObject},
  approvedDownloadOrigins:[origin],
 };
}
